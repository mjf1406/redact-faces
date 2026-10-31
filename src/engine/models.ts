import manifest from './models.manifest.json';
import type { ModelPack } from './constants';

export type ManifestEntry = {
  id: string;
  filename: string;
  bytes: number;
  sha256: string;
  pack: ModelPack;
  available: boolean;
};

export const MODEL_MANIFEST = manifest.models as ManifestEntry[];

export class ModelFilesMissingError extends Error {
  readonly files: string[];
  constructor(files: string[]) {
    super(
      `Model files missing: ${files.join(', ')}. Run bun run models:fetch, then reload. Fast models belong in public/models.`,
    );
    this.name = 'ModelFilesMissingError';
    this.files = files;
  }
}

export function modelsForPack(pack: ModelPack) {
  return MODEL_MANIFEST.filter((model) => model.pack === pack);
}

export function largeModelBaseUrl() {
  const value = import.meta.env.VITE_LARGE_MODEL_BASE_URL;
  if (!value) return null;
  return value.replace(/\/$/, '');
}

export function accuratePackEnabled() {
  return largeModelBaseUrl() != null;
}

export function wasmPrefixFrom(options: {
  ortBaseUrl?: string;
  modelBaseUrl: string | null;
  prod: boolean;
}) {
  const configured = options.ortBaseUrl;
  if (typeof configured === 'string' && configured.length > 0) {
    return configured.endsWith('/') ? configured : `${configured}/`;
  }
  if (options.prod && options.modelBaseUrl) return `${options.modelBaseUrl}/ort/`;
  return '/ort/';
}

export function wasmPrefix() {
  return wasmPrefixFrom({
    ortBaseUrl: import.meta.env.VITE_ORT_WASM_BASE_URL,
    modelBaseUrl: largeModelBaseUrl(),
    prod: import.meta.env.PROD,
  });
}

export function modelUrl(entry: ManifestEntry) {
  if (entry.pack === 'fast') return `/models/${entry.filename}`;
  const base = largeModelBaseUrl();
  if (!base) throw new Error('The Accurate model URL is not configured.');
  return `${base}/${entry.filename}`;
}

export function embeddingModelId(pack: ModelPack) {
  return pack === 'fast' ? 'w600k_mbf' : 'w600k_r50';
}
