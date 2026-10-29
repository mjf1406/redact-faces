import { describe, expect, it } from 'vitest';
import { ARCFACE_TEMPLATE } from './constants';
import { applySimilarity, umeyama } from './umeyama';

const template = ARCFACE_TEMPLATE.map(([x, y]) => ({ x, y }));

describe('umeyama', () => {
  it('recovers identity for the arcface template', () => {
    const sim = umeyama(template, template);
    expect(sim.scale).toBeCloseTo(1, 5);
    expect(sim.r00).toBeCloseTo(1, 5);
    expect(sim.r11).toBeCloseTo(1, 5);
    expect(sim.r01).toBeCloseTo(0, 5);
    expect(sim.r10).toBeCloseTo(0, 5);
    expect(sim.tx).toBeCloseTo(0, 4);
    expect(sim.ty).toBeCloseTo(0, 4);
  });

  it('recovers scale, a quarter turn, and translation', () => {
    const src = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 4 },
    ];
    const dst = src.map((point) => ({ x: -2 * point.y + 5, y: 2 * point.x - 3 }));
    const sim = umeyama(src, dst);
    for (const point of src) {
      const mapped = applySimilarity(sim, point);
      const expected = dst[src.indexOf(point)];
      expect(mapped.x).toBeCloseTo(expected.x, 4);
      expect(mapped.y).toBeCloseTo(expected.y, 4);
    }
    expect(sim.scale).toBeCloseTo(2, 4);
  });
});
