import { describe, expect, it } from 'vitest';
import { detectionTiles, exportScale, jpegRelPath, letterbox, mapInputToSource } from './geometry';

describe('letterbox', () => {
  it('scales to the short side and anchors at the top left', () => {
    const box = letterbox(1000, 500);
    expect(box.scale).toBeCloseTo(0.64);
    expect(box.resizedW).toBeCloseTo(640);
    expect(box.resizedH).toBeCloseTo(320);
  });

  it('maps input pixels back by dividing by scale', () => {
    expect(mapInputToSource(32, 16, 0.5, 10, 20)).toEqual({ x: 74, y: 52 });
  });
});

describe('tiles', () => {
  it('uses one full-frame pass in fast mode', () => {
    expect(detectionTiles(800, 600, 'fast')).toEqual([{ sx: 0, sy: 0, sw: 800, sh: 600 }]);
  });

  it('adds a 2x2 overlap for thorough and a 3x3 overlap for maximum', () => {
    expect(detectionTiles(1750, 1750, 'thorough')).toHaveLength(5);
    expect(detectionTiles(2500, 1000, 'maximum')).toHaveLength(10);
    const thorough = detectionTiles(1750, 1750, 'thorough');
    expect(thorough[1].sw).toBeCloseTo(1000);
    expect(thorough[2].sx).toBeCloseTo(750);
  });
});

describe('export names', () => {
  it('rewrites the extension and avoids collisions', () => {
    const used = new Set<string>();
    expect(jpegRelPath('trip/photo.PNG', used)).toBe('trip/photo.jpg');
    expect(jpegRelPath('trip/photo.jpeg', used)).toBe('trip/photo-2.jpg');
  });

  it('leaves images that already fit', () => {
    expect(exportScale(1000, 800, 1920)).toBe(1);
    expect(exportScale(4000, 3000, 1920)).toBeCloseTo(1920 / 4000);
    expect(exportScale(4000, 3000, null)).toBe(1);
  });
});
