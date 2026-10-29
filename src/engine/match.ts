import { dot, packRows } from './vector';

export type StudentGallery = { id: string; matrix: Float32Array; count: number; dim: number };

export function galleryFromEmbeddings(id: string, embeddings: ArrayLike<number>[]): StudentGallery {
  const dim = embeddings[0]?.length ?? 0;
  return { id, matrix: packRows(embeddings, dim), count: embeddings.length, dim };
}

export function top3Mean(face: ArrayLike<number>, gallery: StudentGallery) {
  if (gallery.count === 0 || gallery.dim === 0) return Number.NEGATIVE_INFINITY;
  const scores = new Array<number>(gallery.count);
  for (let i = 0; i < gallery.count; i += 1) {
    let sum = 0;
    const offset = i * gallery.dim;
    for (let d = 0; d < gallery.dim; d += 1) sum += face[d] * gallery.matrix[offset + d];
    scores[i] = sum;
  }
  scores.sort((a, b) => b - a);
  const k = Math.min(3, scores.length);
  let sum = 0;
  for (let i = 0; i < k; i += 1) sum += scores[i];
  return sum / k;
}

export function suggestStudent(
  face: ArrayLike<number>,
  students: readonly StudentGallery[],
  threshold: number,
  margin: number,
) {
  const ranked: { studentId: string; score: number }[] = [];
  for (const student of students) {
    if (student.count === 0) continue;
    ranked.push({ studentId: student.id, score: top3Mean(face, student) });
  }
  ranked.sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return null;
  const best = ranked[0];
  const second = ranked.length > 1 ? ranked[1].score : Number.NEGATIVE_INFINITY;
  if (best.score >= threshold && best.score - second >= margin) return best;
  return null;
}

export function suggestAll(
  faces: { id: string; embedding: ArrayLike<number> }[],
  students: { id: string; embeddings: ArrayLike<number>[] }[],
  threshold: number,
  margin: number,
) {
  const galleries = students
    .filter((student) => student.embeddings.length > 0)
    .map((student) => galleryFromEmbeddings(student.id, student.embeddings));
  return faces.map((face) => ({
    id: face.id,
    suggestion: suggestStudent(face.embedding, galleries, threshold, margin),
  }));
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>) {
  return dot(a, b);
}
