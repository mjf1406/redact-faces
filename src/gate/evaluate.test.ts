import { describe, expect, it } from 'vitest';
import { GATE_COPY } from './copy';
import { evaluateProbe, forcedGateCode, GATE_CODES, passingProbe } from './evaluate';
import { LIMIT_MAX_BUFFER, LIMIT_STORAGE_BUFFER } from '../engine/constants';

describe('capability gate', () => {
  it('maps each failure and keeps the headlines', () => {
    const probes = [
      passingProbe({ isSecureContext: false }),
      passingProbe({ hasShowDirectoryPicker: false }),
      passingProbe({ userAgent: 'Mozilla/5.0 Firefox/130.0', brands: [] }),
      passingProbe({ hasGpu: false }),
      passingProbe({ adapterPresent: false }),
      passingProbe({ isFallbackAdapter: true }),
      passingProbe({ maxStorageBufferBindingSize: LIMIT_STORAGE_BUFFER - 1 }),
      passingProbe({ maxBufferSize: LIMIT_MAX_BUFFER - 1 }),
      passingProbe({ sessionError: 'boom' }),
      passingProbe({ medianMs: 1501 }),
    ];
    const codes = probes.map((probe) => {
      const result = evaluateProbe(probe);
      if (result.ok) throw new Error('expected a failure');
      return result.code;
    });
    expect(codes).toEqual([
      'INSECURE_CONTEXT',
      'UNSUPPORTED_BROWSER',
      'UNSUPPORTED_BROWSER',
      'NO_WEBGPU',
      'NO_ADAPTER',
      'SOFTWARE_ADAPTER',
      'LIMITS_TOO_LOW',
      'LIMITS_TOO_LOW',
      'SESSION_FAILED',
      'TOO_SLOW',
    ]);
    for (const code of GATE_CODES) {
      expect(GATE_COPY[code].headline.length).toBeGreaterThan(0);
      expect(GATE_COPY[code].steps.length).toBeGreaterThan(0);
    }
  });

  it('warns above 400ms and blocks only above 1500ms', () => {
    expect(evaluateProbe(passingProbe({ medianMs: 400 }))).toEqual({ ok: true, warnSlow: false });
    expect(evaluateProbe(passingProbe({ medianMs: 401 }))).toEqual({ ok: true, warnSlow: true });
    expect(evaluateProbe(passingProbe({ medianMs: 1500 }))).toEqual({ ok: true, warnSlow: true });
  });

  it('reads the preview query', () => {
    expect(forcedGateCode('?forceGateFail=NO_WEBGPU')).toBe('NO_WEBGPU');
    expect(forcedGateCode('?forceGateFail=NOPE')).toBeNull();
  });
});
