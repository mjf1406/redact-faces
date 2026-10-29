import { cosine } from './match';
import { histogram } from '../lib/histogram';

export function confirmedSimilarities(students: { id: string; embeddings: Float32Array[] }[]) {
  const ready = students.filter((student) => student.embeddings.length >= 3);
  if (ready.length < 2) return null;
  const same: number[] = [];
  const different: number[] = [];
  for (const student of ready) {
    for (let i = 0; i < student.embeddings.length; i += 1) {
      for (let j = i + 1; j < student.embeddings.length; j += 1) {
        same.push(cosine(student.embeddings[i], student.embeddings[j]));
      }
    }
  }
  for (let a = 0; a < ready.length; a += 1) {
    for (let b = a + 1; b < ready.length; b += 1) {
      for (const left of ready[a].embeddings) {
        for (const right of ready[b].embeddings) different.push(cosine(left, right));
      }
    }
  }
  return {
    same,
    different,
    sameBins: histogram(same, 10, 0, 1),
    differentBins: histogram(different, 10, 0, 1),
  };
}
