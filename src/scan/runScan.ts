import { db } from '../db/db';
import { getEngine } from '../engine/engineClient';
import { embeddingModelId } from '../engine/models';
import { collectImages, readPermission } from '../lib/files';
import { createId } from '../lib/id';
import { useUi } from '../ui/store';
import { refreshSuggestions } from './suggestions';

export const scanControl = { paused: false, cancel: false };

function failMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The scan failed.';
}

export async function scanProject(projectId: string) {
  if (useUi.getState().scan.running) return;
  const project = await db.projects.get(projectId);
  if (!project?.dirHandle) throw new Error('Choose the photo folder first.');
  if (!(await readPermission(project.dirHandle)))
    throw new Error('Folder permission was not granted.');
  scanControl.cancel = false;
  scanControl.paused = false;
  useUi.setState({
    deviceLost: null,
    scan: {
      running: true,
      paused: false,
      done: 0,
      total: 0,
      current: 'Loading models',
      message: null,
    },
  });
  try {
    const engine = getEngine();
    await engine.init(project.modelPack, (update) => {
      useUi.setState((state) => ({
        scan: {
          ...state.scan,
          current: `Loading ${update.file} (${update.loaded} / ${update.total || '?'})`,
        },
      }));
    });
    const images = await collectImages(project.dirHandle);
    const existing = await db.photos.where('projectId').equals(projectId).toArray();
    const byPath = new Map(existing.map((photo) => [photo.relPath, photo]));
    const seen = new Set<string>();
    for (const image of images) {
      const file = await image.handle.getFile();
      seen.add(image.relPath);
      const prior = byPath.get(image.relPath);
      if (!prior) {
        await db.photos.add({
          id: createId(),
          projectId,
          relPath: image.relPath,
          size: file.size,
          lastModified: file.lastModified,
          width: 0,
          height: 0,
          status: 'pending',
          error: null,
          thumb: null,
        });
      } else if (prior.size !== file.size || prior.lastModified !== file.lastModified) {
        await db.faces.where('photoId').equals(prior.id).delete();
        await db.photos.update(prior.id, {
          size: file.size,
          lastModified: file.lastModified,
          status: 'pending',
          error: null,
          thumb: null,
          width: 0,
          height: 0,
        });
      }
    }
    for (const photo of existing) {
      if (seen.has(photo.relPath)) continue;
      await db.faces.where('photoId').equals(photo.id).delete();
      await db.photos.delete(photo.id);
    }
    const photos = await db.photos.where('projectId').equals(projectId).toArray();
    const queue = photos.filter(
      (photo) => photo.status === 'pending' || photo.status === 'processing',
    );
    let done = photos.length - queue.length;
    useUi.setState({
      scan: {
        running: true,
        paused: false,
        done,
        total: photos.length,
        current: null,
        message: null,
      },
    });
    const handles = new Map(images.map((image) => [image.relPath, image.handle]));
    for (const photo of queue) {
      if (scanControl.cancel) break;
      while (scanControl.paused && !scanControl.cancel) {
        useUi.setState((state) => ({ scan: { ...state.scan, paused: true } }));
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      if (scanControl.cancel) break;
      const handle = handles.get(photo.relPath);
      if (!handle) continue;
      useUi.setState((state) => ({
        scan: { ...state.scan, paused: false, current: photo.relPath },
      }));
      await db.photos.update(photo.id, { status: 'processing', error: null });
      await engine.clearCancel();
      try {
        const file = await handle.getFile();
        const result = await engine.processPhoto(file, file.name, project.settings.detectionMode);
        if (result.status === 'done') {
          await db.transaction('rw', db.photos, db.faces, async () => {
            await db.faces.where('photoId').equals(photo.id).delete();
            await db.photos.update(photo.id, {
              status: 'done',
              width: result.width,
              height: result.height,
              thumb: result.thumb,
              error: null,
            });
            await db.faces.bulkAdd(
              result.faces.map((face) => ({
                id: createId(),
                projectId,
                photoId: photo.id,
                box: face.box,
                kps: face.kps,
                score: face.score,
                lowConfidence: face.lowConfidence || !face.embedding,
                embedding: face.embedding,
                embModel: face.embModel ?? embeddingModelId(project.modelPack),
                crop: face.crop,
                state: 'unassigned' as const,
                studentId: null,
                suggestedStudentId: null,
                suggestionScore: null,
                source: 'detector' as const,
              })),
            );
          });
        } else {
          await db.photos.update(photo.id, { status: result.status, error: result.reason });
        }
      } catch (error) {
        const message = failMessage(error);
        if (message === 'Scan cancelled' || /device lost|destroyed/i.test(message)) {
          await db.photos.update(photo.id, { status: 'pending', error: null });
          if (/device lost|destroyed/i.test(message)) {
            useUi.setState({ deviceLost: message });
            scanControl.cancel = true;
          }
          break;
        }
        await db.photos.update(photo.id, { status: 'error', error: message });
      }
      done += 1;
      useUi.setState((state) => ({ scan: { ...state.scan, done } }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (!scanControl.cancel) await refreshSuggestions(projectId);
  } catch (error) {
    useUi.setState((state) => ({ scan: { ...state.scan, message: failMessage(error) } }));
  } finally {
    scanControl.paused = false;
    useUi.setState((state) => ({
      scan: { ...state.scan, running: false, paused: false, current: null },
    }));
  }
}

export function pauseScan() {
  scanControl.paused = !scanControl.paused;
  useUi.setState((state) => ({ scan: { ...state.scan, paused: scanControl.paused } }));
}

export function cancelScan() {
  scanControl.cancel = true;
  scanControl.paused = false;
  void getEngine().requestCancel();
}
