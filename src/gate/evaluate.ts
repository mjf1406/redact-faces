import {
  LIMIT_MAX_BUFFER,
  LIMIT_STORAGE_BUFFER,
  SLOW_BLOCK_MS,
  SLOW_WARN_MS,
} from '../engine/constants';

export const GATE_CODES = [
  'INSECURE_CONTEXT',
  'UNSUPPORTED_BROWSER',
  'NO_WEBGPU',
  'NO_ADAPTER',
  'SOFTWARE_ADAPTER',
  'LIMITS_TOO_LOW',
  'SESSION_FAILED',
  'TOO_SLOW',
] as const;

export type GateCode = (typeof GATE_CODES)[number];

export type GateProbe = {
  isSecureContext: boolean;
  userAgent: string;
  brands: readonly string[];
  hasShowDirectoryPicker: boolean;
  hasGpu: boolean;
  adapterPresent: boolean;
  isFallbackAdapter: boolean;
  maxStorageBufferBindingSize: number;
  maxBufferSize: number;
  sessionError: string | null;
  medianMs: number | null;
};

export type GateResult = { ok: true; warnSlow: boolean } | { ok: false; code: GateCode };

export function isChromiumBrowser(userAgent: string, brands: readonly string[]) {
  if (brands.some((brand) => /Chromium|Google Chrome|Microsoft Edge/i.test(brand))) return true;
  if (/Firefox\//.test(userAgent)) return false;
  return /Edg\/|Chrome\/|Chromium\//.test(userAgent);
}

export function evaluateProbe(probe: GateProbe): GateResult {
  if (!probe.isSecureContext) return { ok: false, code: 'INSECURE_CONTEXT' };
  if (!probe.hasShowDirectoryPicker || !isChromiumBrowser(probe.userAgent, probe.brands)) {
    return { ok: false, code: 'UNSUPPORTED_BROWSER' };
  }
  if (!probe.hasGpu) return { ok: false, code: 'NO_WEBGPU' };
  if (!probe.adapterPresent) return { ok: false, code: 'NO_ADAPTER' };
  if (probe.isFallbackAdapter) return { ok: false, code: 'SOFTWARE_ADAPTER' };
  if (
    probe.maxStorageBufferBindingSize < LIMIT_STORAGE_BUFFER ||
    probe.maxBufferSize < LIMIT_MAX_BUFFER
  ) {
    return { ok: false, code: 'LIMITS_TOO_LOW' };
  }
  if (probe.sessionError) return { ok: false, code: 'SESSION_FAILED' };
  if (probe.medianMs == null || probe.medianMs > SLOW_BLOCK_MS)
    return { ok: false, code: 'TOO_SLOW' };
  return { ok: true, warnSlow: probe.medianMs > SLOW_WARN_MS };
}

export function forcedGateCode(search: string): GateCode | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const value = params.get('forceGateFail');
  if (!value) return null;
  return (GATE_CODES as readonly string[]).includes(value) ? (value as GateCode) : null;
}

export function passingProbe(overrides: Partial<GateProbe> = {}): GateProbe {
  return {
    isSecureContext: true,
    userAgent: 'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36',
    brands: ['Chromium', 'Google Chrome'],
    hasShowDirectoryPicker: true,
    hasGpu: true,
    adapterPresent: true,
    isFallbackAdapter: false,
    maxStorageBufferBindingSize: LIMIT_STORAGE_BUFFER,
    maxBufferSize: LIMIT_MAX_BUFFER,
    sessionError: null,
    medianMs: 200,
    ...overrides,
  };
}
