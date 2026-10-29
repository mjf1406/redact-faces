/** Detection and matching defaults. Suggest/cluster thresholds are UNTUNED starting points. */
export const INPUT_SIZE = 640;
export const STRIDES = [8, 16, 32] as const;
export const ANCHORS_PER_CELL = 2;
export const DETECTION_SCORE_THRESHOLD = 0.3;
export const LOW_CONFIDENCE_THRESHOLD = 0.5;
export const MIN_BOX_SIDE_PX = 16;
export const NMS_IOU = 0.4;
export const NMS_CONTAIN = 0.7;
export const TILE_OVERLAP = 0.25;

export const CLUSTER_MIN_SCORE = 0.6;
export const CLUSTER_MIN_SIDE_PX = 40;

/** UNTUNED. Adjust with the calibration view after labeling real classes. */
export const DEFAULT_SUGGEST_THRESHOLD = 0.4;
/** UNTUNED. The best student must beat the runner-up by at least this much. */
export const DEFAULT_SUGGEST_MARGIN = 0.05;
/** UNTUNED. Online clustering join threshold. */
export const DEFAULT_CLUSTER_THRESHOLD = 0.5;

export const SUGGEST_THRESHOLD_MIN = 0.25;
export const SUGGEST_THRESHOLD_MAX = 0.7;

export const DEFAULT_REDACTION_PADDING = 0.35;
export const REDACTION_SHIFT_UP = 0.08;
export const DEFAULT_JPEG_QUALITY = 0.92;
export const THUMB_LONG_SIDE = 256;
export const EMBED_SIZE = 512;
export const EMBED_BATCH = 16;

export const SLOW_BLOCK_MS = 1500;
export const SLOW_WARN_MS = 400;
export const LIMIT_STORAGE_BUFFER = 128 * 1024 * 1024;
export const LIMIT_MAX_BUFFER = 256 * 1024 * 1024;

export const ARCFACE_TEMPLATE: ReadonlyArray<readonly [number, number]> = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

export const MODEL_CACHE = 'models-v1';
export const DB_NAME = 'redact-faces';

export function defaultSettings(): ProjectSettings {
  return {
    detectionMode: 'thorough',
    suggestThreshold: DEFAULT_SUGGEST_THRESHOLD,
    suggestMargin: DEFAULT_SUGGEST_MARGIN,
    clusterThreshold: DEFAULT_CLUSTER_THRESHOLD,
    redactionPadding: DEFAULT_REDACTION_PADDING,
    jpegQuality: DEFAULT_JPEG_QUALITY,
    maxExportDimension: null,
  };
}

export type DetectionMode = 'fast' | 'thorough' | 'maximum';
export type ModelPack = 'fast' | 'accurate';
export type Consent = 'yes' | 'no' | null;
export type PhotoStatus = 'pending' | 'processing' | 'done' | 'error' | 'unsupported';
export type FaceState = 'unassigned' | 'suggested' | 'confirmed' | 'safe' | 'falsePositive';
export type FaceSource = 'detector' | 'manual';
export type MaxExportDimension = null | 3840 | 2560 | 1920;

export type ProjectSettings = {
  detectionMode: DetectionMode;
  suggestThreshold: number;
  suggestMargin: number;
  clusterThreshold: number;
  redactionPadding: number;
  jpegQuality: number;
  maxExportDimension: MaxExportDimension;
};

export type NormBox = { x: number; y: number; w: number; h: number };
export type NormPoint = { x: number; y: number };
export type PixelBox = { x1: number; y1: number; x2: number; y2: number };
export type PixelRect = { x: number; y: number; w: number; h: number };
