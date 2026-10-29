import { wrap, type Remote } from 'comlink';
import type { EngineApi } from './engine.worker';

let remote: Remote<EngineApi> | null = null;
let worker: Worker | null = null;

export function getEngine() {
  if (!remote) {
    worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    remote = wrap<EngineApi>(worker);
  }
  return remote;
}

export async function restartEngine() {
  remote?.release().catch(() => undefined);
  worker?.terminate();
  remote = null;
  worker = null;
  return getEngine();
}
