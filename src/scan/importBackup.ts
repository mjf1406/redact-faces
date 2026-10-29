import type { BackupFile } from '../db/backup';
import { db } from '../db/db';
import type { ModelPack } from '../engine/constants';
import { embeddingModelId } from '../engine/models';
import { getEngine } from '../engine/engineClient';
import { collectImages } from '../lib/files';
import { createId } from '../lib/id';
import { refreshSuggestions } from './suggestions';

export async function importBackup(
  backup: BackupFile,
  pack: ModelPack,
  dir: FileSystemDirectoryHandle,
) {
  const projectId = createId();
  await db.projects.add({
    id: projectId,
    name: backup.project.name,
    createdAt: Date.now(),
    modelPack: pack,
    settings: backup.project.settings,
    dirHandle: dir,
  });
  await db.students.bulkAdd(
    backup.students.map((student) => ({
      id: student.id,
      projectId,
      name: student.name,
      consent: student.consent,
    })),
  );
  const images = await collectImages(dir);
  const files: { relPath: string; size: number; file: File }[] = [];
  for (const image of images) {
    const file = await image.handle.getFile();
    files.push({ relPath: image.relPath, size: file.size, file });
  }
  const engine = getEngine();
  await engine.init(pack);
  const unmatched: string[] = [];
  for (const photo of backup.photos) {
    const match = files.find((file) => file.relPath === photo.relPath && file.size === photo.size);
    const photoId = createId();
    if (!match) {
      unmatched.push(photo.relPath);
      await db.photos.add({
        id: photoId,
        projectId,
        relPath: photo.relPath,
        size: photo.size,
        lastModified: photo.lastModified,
        width: photo.width,
        height: photo.height,
        status: 'error',
        error: 'No file in the folder matched this path and file size.',
        thumb: null,
      });
      continue;
    }
    const embedded = await engine.embedLandmarks(
      match.file,
      photo.faces.map((face) => ({ kps: face.kps })),
    );
    await db.photos.add({
      id: photoId,
      projectId,
      relPath: photo.relPath,
      size: photo.size,
      lastModified: photo.lastModified,
      width: embedded.width,
      height: embedded.height,
      status: 'done',
      error: null,
      thumb: null,
    });
    await db.faces.bulkAdd(
      photo.faces.map((face, index) => ({
        id: createId(),
        projectId,
        photoId,
        box: face.box,
        kps: face.kps,
        score: face.score,
        lowConfidence: face.lowConfidence || !embedded.embeddings[index],
        embedding: embedded.embeddings[index],
        embModel: embedded.embeddings[index] ? embeddingModelId(pack) : null,
        crop: null,
        state: face.state === 'suggested' ? ('unassigned' as const) : face.state,
        studentId: face.studentId,
        suggestedStudentId: null,
        suggestionScore: null,
        source: face.source,
      })),
    );
  }
  await refreshSuggestions(projectId);
  return { id: projectId, unmatched };
}
