import { LIMIT_MAX_BUFFER, LIMIT_STORAGE_BUFFER } from '../engine/constants';
import { getEngine, restartEngine } from '../engine/engineClient';
import { reportDeviceLost } from './device';
import { evaluateProbe, forcedGateCode, type GateCode, type GateProbe } from './evaluate';

export type GateFailure = { code: GateCode; errorText: string | null; diagnostics: string };
export type GateSuccess = { warnSlow: boolean; medianMs: number; diagnostics: string };

let probeDevice: GPUDevice | null = null;

function diagnostics(probe: unknown, medianMs: number | null) {
  return JSON.stringify({ probe, medianMs, when: new Date().toISOString() }, null, 2);
}

async function readAdapterInfo(adapter: GPUAdapter) {
  const maybe = adapter.info as GPUAdapterInfo | Promise<GPUAdapterInfo>;
  const info = typeof (maybe as Promise<GPUAdapterInfo>).then === 'function' ? await maybe : maybe;
  return info;
}

export async function runCapabilityGate(): Promise<
  { ok: true; success: GateSuccess } | { ok: false; failure: GateFailure }
> {
  const forced = forcedGateCode(window.location.search);
  if (forced) {
    return {
      ok: false,
      failure: {
        code: forced,
        errorText: forced === 'SESSION_FAILED' ? 'Forced preview error.' : null,
        diagnostics: diagnostics({ sessionError: 'forced' }, null),
      },
    };
  }
  const brands = navigator.userAgentData?.brands?.map((brand) => brand.brand) ?? [];
  const base: GateProbe = {
    isSecureContext: window.isSecureContext,
    userAgent: navigator.userAgent,
    brands,
    hasShowDirectoryPicker: typeof window.showDirectoryPicker === 'function',
    hasGpu: typeof navigator.gpu?.requestAdapter === 'function',
    adapterPresent: false,
    isFallbackAdapter: false,
    maxStorageBufferBindingSize: 0,
    maxBufferSize: 0,
    sessionError: null,
    medianMs: null,
  };
  const early = evaluateProbe(base);
  if (
    !early.ok &&
    early.code !== 'NO_ADAPTER' &&
    early.code !== 'SOFTWARE_ADAPTER' &&
    early.code !== 'LIMITS_TOO_LOW' &&
    early.code !== 'SESSION_FAILED' &&
    early.code !== 'TOO_SLOW'
  ) {
    return {
      ok: false,
      failure: { code: early.code, errorText: null, diagnostics: diagnostics(base, null) },
    };
  }
  if (!base.hasGpu) {
    return {
      ok: false,
      failure: { code: 'NO_WEBGPU', errorText: null, diagnostics: diagnostics(base, null) },
    };
  }
  let adapter: GPUAdapter | null = null;
  try {
    adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  } catch (error) {
    base.sessionError = error instanceof Error ? error.message : 'requestAdapter failed';
  }
  if (!adapter) {
    const result = evaluateProbe({ ...base, adapterPresent: false });
    const code = result.ok ? 'NO_ADAPTER' : result.code;
    return {
      ok: false,
      failure: { code, errorText: base.sessionError, diagnostics: diagnostics(base, null) },
    };
  }
  const info = await readAdapterInfo(adapter);
  const infoFallback = 'isFallbackAdapter' in info && info.isFallbackAdapter === true;
  base.adapterPresent = true;
  base.isFallbackAdapter = adapter.isFallbackAdapter === true || infoFallback;
  base.maxStorageBufferBindingSize = adapter.limits.maxStorageBufferBindingSize ?? 0;
  base.maxBufferSize = adapter.limits.maxBufferSize ?? 0;
  const afterAdapter = evaluateProbe({ ...base, medianMs: 0 });
  if (!afterAdapter.ok) {
    return {
      ok: false,
      failure: {
        code: afterAdapter.code,
        errorText: null,
        diagnostics: diagnostics({ ...base, adapter: info }, null),
      },
    };
  }
  try {
    probeDevice?.destroy();
    probeDevice = await adapter.requestDevice();
    void probeDevice.lost.then((lost) => {
      reportDeviceLost(lost.message || 'The graphics device was lost.');
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not open a GPU device.';
    return {
      ok: false,
      failure: { code: 'SESSION_FAILED', errorText: message, diagnostics: diagnostics(base, null) },
    };
  }
  let medianMs: number | null = null;
  try {
    await restartEngine();
    const engine = getEngine();
    await engine.init('fast');
    medianMs = (await engine.smoke()).medianMs;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The model session failed.';
    return {
      ok: false,
      failure: {
        code: 'SESSION_FAILED',
        errorText: message,
        diagnostics: diagnostics(base, medianMs),
      },
    };
  }
  const finalProbe = { ...base, medianMs };
  const result = evaluateProbe(finalProbe);
  const text = diagnostics(
    {
      ...finalProbe,
      adapter: info,
      limits: { storage: LIMIT_STORAGE_BUFFER, buffer: LIMIT_MAX_BUFFER },
    },
    medianMs,
  );
  if (!result.ok)
    return { ok: false, failure: { code: result.code, errorText: null, diagnostics: text } };
  return {
    ok: true,
    success: { warnSlow: result.warnSlow, medianMs: medianMs ?? 0, diagnostics: text },
  };
}
