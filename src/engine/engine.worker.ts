import { expose } from 'comlink';
import { EMBED_SIZE, INPUT_SIZE, type DetectionMode, type ModelPack } from './constants';
import { clusterFaces, type ClusterFace } from './cluster';
import { detectionTiles } from './geometry';
import { alignFace, detectionInput, photoThumb } from './imagePrep';
import { suggestAll } from './match';
import { embeddingModelId, wasmPrefix } from './models';
import { loadPack } from './modelStore';
import { decodeScrfd, nms, type TensorView } from './scrfd';
import { l2normalize } from './vector';
import { median } from '../lib/histogram';
import type { NormPoint } from './constants';

type OrtTensor = {
  dims: readonly number[];
  getData: (release?: boolean) => Promise<Float32Array>;
  dispose?: () => void;
};

type OrtSession = {
  run: (feeds: Record<string, unknown>) => Promise<Record<string, OrtTensor>>;
  inputNames: readonly string[];
  outputNames: readonly string[];
  inputMetadata: readonly { isTensor: boolean; shape?: readonly (number | string)[] }[];
  outputMetadata: readonly { isTensor: boolean; shape?: readonly (number | string)[] }[];
  release: () => Promise<void>;
};

type Ort = {
  env: { wasm: { numThreads: number; proxy: boolean; wasmPaths: string } };
  InferenceSession: {
    create: (
      buffer: ArrayBuffer,
      options: { executionProviders: string[]; graphOptimizationLevel: 'all' },
    ) => Promise<OrtSession>;
  };
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown;
};

export type DetectedFace = {
  box: { x: number; y: number; w: number; h: number };
  kps: NormPoint[];
  score: number;
  lowConfidence: boolean;
  embedding: Float32Array | null;
  embModel: string | null;
  crop: Blob | null;
};

export type PhotoResult =
  | { status: 'done'; width: number; height: number; thumb: Blob; faces: DetectedFace[] }
  | { status: 'unsupported'; reason: string }
  | { status: 'error'; reason: string };

let ortPromise: Promise<Ort> | null = null;
let detector: OrtSession | null = null;
let embedder: OrtSession | null = null;
let packInUse: ModelPack | null = null;
let cancelRequested = false;
let embedBatch = 1;

function wasmFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/wasm|fetch|404|network/i.test(message)) {
    return new Error(
      `${message} The WebGPU runtime is loaded from ${wasmPrefix()}ort-wasm-simd-threaded.asyncify.mjs. ort-wasm-simd-threaded.asyncify.wasm is 28,747,738 bytes, over the Cloudflare Pages limit, so a production build loads it from the ort/ folder of the same bucket as VITE_LARGE_MODEL_BASE_URL. Upload that wasm file and ort-wasm-simd-threaded.asyncify.mjs there. Local bun run dev serves both files from node_modules.`,
    );
  }
  return error instanceof Error ? error : new Error(message);
}

async function ortRuntime() {
  ortPromise ??= import('onnxruntime-web/webgpu').then((mod) => {
    const ort = mod as unknown as Ort;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = wasmPrefix();
    return ort;
  });
  return ortPromise;
}

async function createSession(ort: Ort, buffer: ArrayBuffer) {
  return ort.InferenceSession.create(buffer, {
    executionProviders: ['webgpu'],
    graphOptimizationLevel: 'all',
  });
}

function batchLimit(session: OrtSession) {
  const input = session.inputMetadata[0];
  const output = session.outputMetadata[0];
  const inputBatch = input?.isTensor ? input.shape?.[0] : undefined;
  const outputBatch = output?.isTensor ? output.shape?.[0] : undefined;
  if (typeof outputBatch === 'number') return outputBatch;
  if (typeof inputBatch === 'number') return inputBatch;
  return 16;
}

async function outputsOf(
  session: OrtSession,
  feeds: Record<string, unknown>,
): Promise<TensorView[]> {
  const result = await session.run(feeds);
  const views: TensorView[] = [];
  for (const name of session.outputNames) {
    const tensor = result[name];
    const data = await tensor.getData(true);
    views.push({ name, data, dims: [...tensor.dims] });
    tensor.dispose?.();
  }
  return views;
}

const api = {
  async init(
    pack: ModelPack,
    onProgress?: (update: { file: string; loaded: number; total: number }) => void,
  ) {
    if (detector && embedder && packInUse === pack) return;
    await api.release();
    const ort = await ortRuntime();
    const buffers = await loadPack(pack, (update) => onProgress?.(update));
    const detId = pack === 'fast' ? 'det_500m' : 'det_10g';
    const embId = embeddingModelId(pack);
    const detBuffer = buffers.get(detId);
    const embBuffer = buffers.get(embId);
    if (!detBuffer || !embBuffer) throw new Error('Model buffers were incomplete.');
    try {
      detector = await createSession(ort, detBuffer);
      embedder = await createSession(ort, embBuffer);
    } catch (error) {
      throw wasmFailure(error);
    }
    embedBatch = Math.max(1, Math.min(16, batchLimit(embedder)));
    packInUse = pack;
  },

  async release() {
    await detector?.release();
    await embedder?.release();
    detector = null;
    embedder = null;
    packInUse = null;
  },

  requestCancel() {
    cancelRequested = true;
  },

  clearCancel() {
    cancelRequested = false;
  },

  async processPhoto(file: Blob, filename: string, mode: DetectionMode): Promise<PhotoResult> {
    if (!detector || !embedder || !packInUse) throw new Error('The face engine is not loaded.');
    const extension = filename.split('.').pop()?.toLowerCase() ?? '';
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Could not decode this file.';
      const unsupported =
        extension === 'heic' ||
        extension === 'heif' ||
        !['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(extension);
      if (unsupported) {
        return {
          status: 'unsupported',
          reason: `${reason} Convert this file to JPEG first.`,
        };
      }
      return { status: 'error', reason };
    }
    try {
      const thumb = await photoThumb(bitmap);
      const found = [];
      for (const tile of detectionTiles(bitmap.width, bitmap.height, mode)) {
        if (cancelRequested) throw new Error('Scan cancelled');
        const input = detectionInput(bitmap, tile);
        const tensor = new (await ortRuntime()).Tensor('float32', input.data, [
          1,
          3,
          INPUT_SIZE,
          INPUT_SIZE,
        ]);
        const outputs = await outputsOf(detector, { [detector.inputNames[0]]: tensor });
        found.push(
          ...decodeScrfd(outputs, { scale: input.scale, originX: tile.sx, originY: tile.sy }),
        );
      }
      const kept = nms(found);
      const faces: DetectedFace[] = [];
      for (const det of kept) {
        const box = {
          x: clamp01(det.x1 / bitmap.width),
          y: clamp01(det.y1 / bitmap.height),
          w: clamp01((det.x2 - det.x1) / bitmap.width),
          h: clamp01((det.y2 - det.y1) / bitmap.height),
        };
        const kps = det.kps.map((point) => ({
          x: clamp01(point.x / bitmap.width),
          y: clamp01(point.y / bitmap.height),
        }));
        let embedding: Float32Array | null = null;
        let crop: Blob | null = null;
        try {
          const aligned = await alignFace(
            bitmap,
            det.kps.map((point) => ({
              x: Math.min(bitmap.width, Math.max(0, point.x)),
              y: Math.min(bitmap.height, Math.max(0, point.y)),
            })),
          );
          crop = aligned.blob;
          embedding = await embedOne(aligned.data);
        } catch {
          embedding = null;
        }
        faces.push({
          box,
          kps,
          score: det.score,
          lowConfidence: det.lowConfidence,
          embedding,
          embModel: embedding ? embeddingModelId(packInUse) : null,
          crop,
        });
      }
      return { status: 'done', width: bitmap.width, height: bitmap.height, thumb, faces };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'This photo failed.';
      if (reason === 'Scan cancelled') throw error;
      return { status: 'error', reason };
    } finally {
      bitmap.close();
    }
  },

  async embedLandmarks(file: Blob, faces: { kps: NormPoint[] }[]) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      const embeddings: (Float32Array | null)[] = [];
      for (const face of faces) {
        if (face.kps.length !== 5) {
          embeddings.push(null);
          continue;
        }
        const aligned = await alignFace(
          bitmap,
          face.kps.map((point) => ({ x: point.x * bitmap.width, y: point.y * bitmap.height })),
        );
        embeddings.push(await embedOne(aligned.data));
      }
      return { width: bitmap.width, height: bitmap.height, embeddings };
    } finally {
      bitmap.close();
    }
  },

  suggest: suggestAll,
  cluster(faces: ClusterFace[], threshold: number) {
    return clusterFaces(faces, threshold).map((cluster) => cluster.faceIds);
  },

  async smoke() {
    if (!detector || !embedder) throw new Error('The face engine is not loaded.');
    const detData = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const embData = new Float32Array(3 * 112 * 112);
    const once = async () => {
      const started = performance.now();
      const ort = await ortRuntime();
      const det = new ort.Tensor('float32', detData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
      await outputsOf(detector as OrtSession, { [detector!.inputNames[0]]: det });
      const emb = new ort.Tensor('float32', embData, [1, 3, 112, 112]);
      await outputsOf(embedder as OrtSession, { [embedder!.inputNames[0]]: emb });
      return performance.now() - started;
    };
    for (let i = 0; i < 3; i += 1) await once();
    const samples: number[] = [];
    for (let i = 0; i < 5; i += 1) samples.push(await once());
    return { medianMs: median(samples) };
  },
};

async function embedOne(data: Float32Array) {
  if (!embedder) throw new Error('The embedding model is not loaded.');
  if (embedBatch < 1) throw new Error('The embedding batch size is invalid.');
  const ort = await ortRuntime();
  const tensor = new ort.Tensor('float32', data, [1, 3, 112, 112]);
  const outputs = await outputsOf(embedder, { [embedder.inputNames[0]]: tensor });
  const values = outputs[0]?.data;
  if (!values || values.length < EMBED_SIZE)
    throw new Error('Embedding output was the wrong size.');
  return l2normalize(values.subarray(0, EMBED_SIZE));
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export type EngineApi = typeof api;

expose(api);
