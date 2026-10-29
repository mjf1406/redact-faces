import { db } from '../db/db';
import { getEngine } from '../engine/engineClient';
import { isClusterEligible } from '../engine/cluster';

export async function refreshSuggestions(projectId: string) {
  const project = await db.projects.get(projectId);
  if (!project) return;
  const [students, faces] = await Promise.all([
    db.students.where('projectId').equals(projectId).toArray(),
    db.faces.where('projectId').equals(projectId).toArray(),
  ]);
  const targets = faces.filter(
    (face) => (face.state === 'unassigned' || face.state === 'suggested') && face.embedding,
  );
  const galleries = students.map((student) => ({
    id: student.id,
    embeddings: faces
      .filter(
        (face) => face.state === 'confirmed' && face.studentId === student.id && face.embedding,
      )
      .map((face) => face.embedding as Float32Array),
  }));
  const engine = getEngine();
  const results = await engine.suggest(
    targets.map((face) => ({ id: face.id, embedding: face.embedding as Float32Array })),
    galleries,
    project.settings.suggestThreshold,
    project.settings.suggestMargin,
  );
  await db.transaction('rw', db.faces, async () => {
    for (const result of results) {
      if (result.suggestion) {
        await db.faces.update(result.id, {
          state: 'suggested',
          suggestedStudentId: result.suggestion.studentId,
          suggestionScore: result.suggestion.score,
        });
      } else {
        await db.faces.update(result.id, {
          state: 'unassigned',
          suggestedStudentId: null,
          suggestionScore: null,
        });
      }
    }
  });
}

export async function clusterUnassigned(projectId: string) {
  const project = await db.projects.get(projectId);
  if (!project) return [];
  const [faces, photos] = await Promise.all([
    db.faces.where('projectId').equals(projectId).toArray(),
    db.photos.where('projectId').equals(projectId).toArray(),
  ]);
  const photosById = new Map(photos.map((photo) => [photo.id, photo]));
  const eligible = faces.filter((face) => {
    const photo = photosById.get(face.photoId);
    if (!photo) return false;
    return isClusterEligible({ ...face, width: photo.width, height: photo.height });
  });
  const engine = getEngine();
  return engine.cluster(
    eligible.map((face) => ({ id: face.id, embedding: face.embedding as Float32Array })),
    project.settings.clusterThreshold,
  );
}
