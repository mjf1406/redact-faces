import {
  ANCHORS_PER_CELL,
  DETECTION_SCORE_THRESHOLD,
  INPUT_SIZE,
  LOW_CONFIDENCE_THRESHOLD,
  MIN_BOX_SIDE_PX,
  NMS_CONTAIN,
  NMS_IOU,
  STRIDES,
} from './constants';
import type { PixelBox } from './constants';
import { mapInputToSource } from './geometry';

export type TensorView = { name: string; data: Float32Array; dims: number[] };

export type Detection = PixelBox & {
  score: number;
  lowConfidence: boolean;
  kps: { x: number; y: number }[];
};

export type ScrfdGroup = {
  stride: number;
  scores: TensorView;
  bbox: TensorView;
  kps: TensorView;
};

const ANCHORS_TO_STRIDE: Record<number, number> = { 12800: 8, 3200: 16, 800: 32 };

export function anchorCenters(stride: number, inputSize = INPUT_SIZE) {
  const cells = inputSize / stride;
  const centers: { cx: number; cy: number }[] = [];
  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col < cells; col += 1) {
      const cx = col * stride;
      const cy = row * stride;
      for (let anchor = 0; anchor < ANCHORS_PER_CELL; anchor += 1) centers.push({ cx, cy });
    }
  }
  return centers;
}

export function distance2bbox(cx: number, cy: number, l: number, t: number, r: number, b: number) {
  return { x1: cx - l, y1: cy - t, x2: cx + r, y2: cy + b };
}

export function distance2kps(cx: number, cy: number, dist: ArrayLike<number>) {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 5; i += 1) {
    points.push({ x: cx + dist[i * 2], y: cy + dist[i * 2 + 1] });
  }
  return points;
}

export function iou(a: PixelBox, b: PixelBox) {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h;
  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  const union = areaA + areaB - inter;
  return union <= 0 ? 0 : inter / union;
}

export function containedFraction(inner: PixelBox, outer: PixelBox) {
  const x1 = Math.max(inner.x1, outer.x1);
  const y1 = Math.max(inner.y1, outer.y1);
  const x2 = Math.min(inner.x2, outer.x2);
  const y2 = Math.min(inner.y2, outer.y2);
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return 0;
  const area = Math.max(0, inner.x2 - inner.x1) * Math.max(0, inner.y2 - inner.y1);
  return area <= 0 ? 0 : (w * h) / area;
}

export function nms(dets: Detection[], iouThresh = NMS_IOU, containThresh = NMS_CONTAIN) {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];
  for (const det of sorted) {
    const suppressed = kept.some(
      (prev) => iou(det, prev) >= iouThresh || containedFraction(det, prev) > containThresh,
    );
    if (!suppressed) kept.push(det);
  }
  return kept;
}

function classify(tensor: TensorView) {
  const dims = tensor.dims;
  let anchors = 0;
  let components = 0;
  if (dims.length === 2) {
    anchors = dims[0];
    components = dims[1];
  } else if (dims.length === 3 && dims[0] === 1) {
    anchors = dims[1];
    components = dims[2];
  }
  const stride = ANCHORS_TO_STRIDE[anchors];
  if (!stride || (components !== 1 && components !== 4 && components !== 10)) return null;
  return { stride, components };
}

export function groupScrfdOutputs(outputs: TensorView[]): ScrfdGroup[] {
  const grouped = new Map<number, Partial<ScrfdGroup> & { stride: number }>();
  let classified = 0;
  for (const output of outputs) {
    const kind = classify(output);
    if (!kind) continue;
    classified += 1;
    const slot = grouped.get(kind.stride) ?? { stride: kind.stride };
    if (kind.components === 1) slot.scores = output;
    if (kind.components === 4) slot.bbox = output;
    if (kind.components === 10) slot.kps = output;
    grouped.set(kind.stride, slot);
  }
  const byShape = [...grouped.values()];
  if (
    classified === outputs.length &&
    byShape.length === 3 &&
    byShape.every((group) => group.scores && group.bbox && group.kps)
  ) {
    return byShape.map((group) => ({
      stride: group.stride,
      scores: group.scores as TensorView,
      bbox: group.bbox as TensorView,
      kps: group.kps as TensorView,
    }));
  }
  if (outputs.length < 9) throw new Error(`Expected 9 SCRFD outputs, got ${outputs.length}`);
  return STRIDES.map((stride, index) => ({
    stride,
    scores: outputs[index],
    bbox: outputs[index + 3],
    kps: outputs[index + 6],
  }));
}

function indexOf(
  tensor: TensorView,
  anchors: number,
  components: number,
  anchor: number,
  component: number,
) {
  const dims = tensor.dims;
  const channelFirst =
    (dims.length === 2 && dims[0] === components && dims[1] === anchors) ||
    (dims.length === 3 && dims[1] === components && dims[2] === anchors);
  if (channelFirst) return component * anchors + anchor;
  return anchor * components + component;
}

function needsSigmoid(groups: ScrfdGroup[]) {
  for (const group of groups) {
    const data = group.scores.data;
    const sample = Math.min(data.length, 256);
    for (let i = 0; i < sample; i += 1) {
      if (data[i] < 0 || data[i] > 1) return true;
    }
  }
  return false;
}

export function decodeScrfd(
  outputs: TensorView[],
  map: { scale: number; originX: number; originY: number },
  inputSize = INPUT_SIZE,
) {
  const groups = groupScrfdOutputs(outputs);
  const sigmoid = needsSigmoid(groups);
  const dets: Detection[] = [];
  for (const group of groups) {
    const anchors = anchorCenters(group.stride, inputSize);
    for (let i = 0; i < anchors.length; i += 1) {
      let score = group.scores.data[indexOf(group.scores, anchors.length, 1, i, 0)];
      if (sigmoid) score = 1 / (1 + Math.exp(-score));
      if (score < DETECTION_SCORE_THRESHOLD) continue;
      const stride = group.stride;
      const box = distance2bbox(
        anchors[i].cx,
        anchors[i].cy,
        group.bbox.data[indexOf(group.bbox, anchors.length, 4, i, 0)] * stride,
        group.bbox.data[indexOf(group.bbox, anchors.length, 4, i, 1)] * stride,
        group.bbox.data[indexOf(group.bbox, anchors.length, 4, i, 2)] * stride,
        group.bbox.data[indexOf(group.bbox, anchors.length, 4, i, 3)] * stride,
      );
      const kpsInput: number[] = [];
      for (let k = 0; k < 10; k += 1) {
        kpsInput.push(group.kps.data[indexOf(group.kps, anchors.length, 10, i, k)] * stride);
      }
      const kps = distance2kps(anchors[i].cx, anchors[i].cy, kpsInput).map((point) =>
        mapInputToSource(point.x, point.y, map.scale, map.originX, map.originY),
      );
      const p1 = mapInputToSource(box.x1, box.y1, map.scale, map.originX, map.originY);
      const p2 = mapInputToSource(box.x2, box.y2, map.scale, map.originX, map.originY);
      const x1 = Math.min(p1.x, p2.x);
      const y1 = Math.min(p1.y, p2.y);
      const x2 = Math.max(p1.x, p2.x);
      const y2 = Math.max(p1.y, p2.y);
      if (Math.min(x2 - x1, y2 - y1) < MIN_BOX_SIDE_PX) continue;
      dets.push({
        x1,
        y1,
        x2,
        y2,
        score,
        lowConfidence: score < LOW_CONFIDENCE_THRESHOLD,
        kps,
      });
    }
  }
  return dets;
}
