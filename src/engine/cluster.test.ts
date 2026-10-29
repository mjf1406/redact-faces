import { describe, expect, it } from 'vitest';
import { clusterFaces, isClusterEligible } from './cluster';

function unit(index: number) {
  const values = new Float32Array(4);
  values[index] = 1;
  return values;
}

describe('clustering', () => {
  it('keeps interleaved copies of two people in two clusters', () => {
    const faces = [0, 1, 0, 1, 0, 1].map((axis, index) => ({
      id: `f${index}`,
      embedding: unit(axis),
    }));
    const clusters = clusterFaces(faces, 0.5);
    const groups = clusters.map((cluster) => [...cluster.faceIds].sort());
    expect(groups).toEqual([
      ['f0', 'f2', 'f4'],
      ['f1', 'f3', 'f5'],
    ]);
  });

  it('starts a new cluster below the cosine threshold', () => {
    const clusters = clusterFaces(
      [
        { id: 'a', embedding: unit(0) },
        { id: 'b', embedding: unit(1) },
      ],
      0.5,
    );
    expect(clusters).toHaveLength(2);
  });

  it('ignores small or low-scoring faces', () => {
    expect(
      isClusterEligible({
        score: 0.9,
        box: { x: 0, y: 0, w: 0.2, h: 0.2 },
        width: 100,
        height: 100,
        state: 'unassigned',
        embedding: unit(0),
      }),
    ).toBe(false);
    expect(
      isClusterEligible({
        score: 0.4,
        box: { x: 0, y: 0, w: 0.5, h: 0.5 },
        width: 200,
        height: 200,
        state: 'unassigned',
        embedding: unit(0),
      }),
    ).toBe(false);
  });
});
