import { MODEL_CACHE } from './constants';
import { ModelFilesMissingError, modelUrl, modelsForPack, type ManifestEntry } from './models';
import type { ModelPack } from './constants';

export async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readStream(response: Response, onProgress: (loaded: number, total: number) => void) {
  const total = Number(response.headers.get('content-length') ?? 0);
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    onProgress(buffer.byteLength, buffer.byteLength);
    return buffer;
  }
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    if (!step.value) continue;
    chunks.push(step.value);
    loaded += step.value.byteLength;
    onProgress(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

export async function loadModelBytes(
  entry: ManifestEntry,
  onProgress: (loaded: number, total: number) => void,
) {
  if (!entry.available || !entry.sha256) throw new ModelFilesMissingError([entry.filename]);
  const url = modelUrl(entry);
  const cache = await caches.open(MODEL_CACHE);
  const cached = await cache.match(url);
  if (cached) {
    const buffer = await cached.arrayBuffer();
    if ((await sha256Hex(buffer)) === entry.sha256) {
      onProgress(buffer.byteLength, buffer.byteLength);
      return buffer;
    }
  }
  const response = await fetch(url);
  if (!response.ok) throw new ModelFilesMissingError([entry.filename]);
  const buffer = await readStream(response, onProgress);
  const hash = await sha256Hex(buffer);
  if (hash !== entry.sha256) {
    throw new Error(`SHA-256 mismatch for ${entry.filename}. The download was discarded.`);
  }
  await cache.put(
    url,
    new Response(buffer, { headers: { 'Content-Type': 'application/octet-stream' } }),
  );
  return buffer;
}

export async function loadPack(
  pack: ModelPack,
  onProgress: (update: { file: string; loaded: number; total: number }) => void,
) {
  const entries = modelsForPack(pack);
  const missing = entries
    .filter((entry) => !entry.available || !entry.sha256)
    .map((entry) => entry.filename);
  if (missing.length > 0) throw new ModelFilesMissingError(missing);
  const buffers = new Map<string, ArrayBuffer>();
  for (const entry of entries) {
    const buffer = await loadModelBytes(entry, (loaded, total) =>
      onProgress({ file: entry.filename, loaded, total }),
    );
    buffers.set(entry.id, buffer);
  }
  return buffers;
}

export async function clearModelCache() {
  await caches.delete(MODEL_CACHE);
}
