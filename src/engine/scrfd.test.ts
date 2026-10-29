import { describe, expect, it } from 'vitest';
import {
  anchorCenters,
  containedFraction,
  decodeScrfd,
  distance2bbox,
  distance2kps,
  groupScrfdOutputs,
  iou,
  nms,
  type Detection,
  type TensorView,
} from './scrfd';

function zeros(anchors: number, components: number, name: string): TensorView {
  return { name, data: new Float32Array(anchors * components), dims: [anchors, components] };
}

describe('anchors and distances', () => {
  it('places two anchors on each cell center', () => {
    const centers = anchorCenters(32);
    expect(centers).toHaveLength(800);
    expect(centers[0]).toEqual({ cx: 0, cy: 0 });
    expect(centers[2]).toEqual({ cx: 32, cy: 0 });
    expect(centers[40]).toEqual({ cx: 0, cy: 32 });
  });

  it('converts distances into a box and five keypoints', () => {
    expect(distance2bbox(32, 32, 8, 8, 8, 8)).toEqual({ x1: 24, y1: 24, x2: 40, y2: 40 });
    expect(distance2kps(10, 20, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([
      { x: 11, y: 22 },
      { x: 13, y: 24 },
      { x: 15, y: 26 },
      { x: 17, y: 28 },
      { x: 19, y: 30 },
    ]);
  });
});

describe('nms', () => {
  const box = (x1: number, y1: number, x2: number, y2: number, score: number): Detection => ({
    x1,
    y1,
    x2,
    y2,
    score,
    lowConfidence: false,
    kps: [],
  });

  it('keeps the higher score when IoU is high', () => {
    const kept = nms([box(0, 0, 10, 10, 0.4), box(1, 1, 10, 10, 0.9)]);
    expect(kept.map((item) => item.score)).toEqual([0.9]);
  });

  it('suppresses a box mostly contained in a higher-scoring box', () => {
    const large = box(0, 0, 100, 100, 0.8);
    const inner = box(10, 10, 20, 20, 0.7);
    expect(iou(inner, large)).toBeLessThan(0.4);
    expect(containedFraction(inner, large)).toBeGreaterThan(0.7);
    expect(nms([inner, large])).toHaveLength(1);
  });
});

describe('decode', () => {
  it('groups real SCRFD shapes even when output order is shuffled', () => {
    const tensors = [
      zeros(800, 10, '499'),
      zeros(12800, 1, '443'),
      zeros(3200, 4, '471'),
      zeros(800, 1, '493'),
      zeros(12800, 4, '446'),
      zeros(3200, 1, '468'),
      zeros(800, 4, '496'),
      zeros(12800, 10, '449'),
      zeros(3200, 10, '474'),
    ];
    const groups = groupScrfdOutputs(tensors);
    expect(groups.find((group) => group.stride === 8)?.scores.name).toBe('443');
    expect(groups.find((group) => group.stride === 32)?.kps.name).toBe('499');
  });

  it('decodes one high-scoring anchor and marks a weaker one low confidence', () => {
    const tensors = [
      zeros(12800, 1, 's8'),
      zeros(3200, 1, 's16'),
      zeros(800, 1, 's32'),
      zeros(12800, 4, 'b8'),
      zeros(3200, 4, 'b16'),
      zeros(800, 4, 'b32'),
      zeros(12800, 10, 'k8'),
      zeros(3200, 10, 'k16'),
      zeros(800, 10, 'k32'),
    ];
    tensors[2].data[0] = 0.92;
    tensors[5].data.set([2, 2, 2, 2]);
    tensors[2].data[1] = 0.42;
    tensors[5].data.set([2, 2, 2, 2], 4);
    const dets = decodeScrfd(tensors, { scale: 1, originX: 0, originY: 0 });
    expect(dets).toHaveLength(2);
    expect(dets[0].lowConfidence).toBe(false);
    expect(dets[1].lowConfidence).toBe(true);
    expect(dets[0].x2 - dets[0].x1).toBeCloseTo(128);
  });

  it('applies sigmoid when scores are logits', () => {
    const tensors = [
      zeros(12800, 1, '0'),
      zeros(3200, 1, '1'),
      zeros(800, 1, '2'),
      zeros(12800, 4, '3'),
      zeros(3200, 4, '4'),
      zeros(800, 4, '5'),
      zeros(12800, 10, '6'),
      zeros(3200, 10, '7'),
      zeros(800, 10, '8'),
    ];
    tensors[2].data.fill(-8);
    tensors[2].data[0] = 5;
    tensors[5].data.set([2, 2, 2, 2]);
    const dets = decodeScrfd(tensors, { scale: 1, originX: 100, originY: 50 });
    expect(dets).toHaveLength(1);
    expect(dets[0].score).toBeGreaterThan(0.99);
    expect(dets[0].x1).toBeCloseTo(36);
  });
});
