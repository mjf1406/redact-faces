import { db } from '../db/db';
import type { ModelPack } from '../engine/constants';
import { getEngine } from '../engine/engineClient';
import { embeddingModelId } from '../engine/models';
import { fileByRelPath } from '../lib/files';
import { refreshSuggestions } from './suggestions';

export async function reembedProject(projectId: string, pack: ModelPack) {
  const project = await db.projects.get(projectId);
  if (!project?.dirHandle) throw new Error('Reconnect the photo folder first.');
  await db.projects.update(projectId, { modelPack: pack });
  const engine = getEngine();
  await engine.init(pack);
  const photos = await db.photos.where('projectId').equals(projectId).toArray();
  for (const photo of photos) {
    if (photo.status !== 'done') continue;
    const faces = await db.faces.where('photoId').equals(photo.id).toArray();
    const file = await fileByRelPath(project.dirHandle, photo.relPath);
    const embedded = await engine.embedLandmarks(
      file,
      faces.map((face) => ({ kps: face.kps })),
    );
    for (let index = 0; index < faces.length; index += 1) {
      const embedding = faces[index].source === 'manual' ? null : embedded.embeddings[index];
      await db.faces.update(faces[index].id, {
        embedding,
        embModel: embedding ? embeddingModelId(pack) : null,
      });
    }
  }
  await refreshSuggestions(projectId);
}
