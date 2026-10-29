import { describe, expect, it } from 'vitest';
import { suggestStudent, top3Mean, galleryFromEmbeddings } from './match';

function unit(index: number, dim = 8) {
  const values = new Float32Array(dim);
  values[index] = 1;
  return values;
}

describe('matching', () => {
  it('averages the top three similarities', () => {
    const gallery = galleryFromEmbeddings('a', [unit(0), unit(1), unit(0), unit(2), unit(3)]);
    expect(top3Mean(unit(0), gallery)).toBeCloseTo(2 / 3);
  });

  it('suggests the best student when the margin is clear', () => {
    const suggestion = suggestStudent(
      unit(0),
      [galleryFromEmbeddings('ada', [unit(0), unit(0)]), galleryFromEmbeddings('alan', [unit(1)])],
      0.4,
      0.05,
    );
    expect(suggestion).toEqual({ studentId: 'ada', score: 1 });
  });

  it('withholds a suggestion when two students are too close', () => {
    const face = new Float32Array([0.8, 0.6, 0, 0]);
    const suggestion = suggestStudent(
      face,
      [
        galleryFromEmbeddings('a', [new Float32Array([1, 0, 0, 0])]),
        galleryFromEmbeddings('b', [new Float32Array([0.6, 0.8, 0, 0])]),
      ],
      0.25,
      0.5,
    );
    expect(suggestion).toBeNull();
  });
});
