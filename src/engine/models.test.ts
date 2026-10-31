import { describe, expect, it } from 'vitest';
import { wasmPrefixFrom } from './models';

const models = 'https://pub-example.r2.dev';

describe('wasmPrefixFrom', () => {
  it('serves the local runtime during development', () => {
    expect(wasmPrefixFrom({ modelBaseUrl: models, prod: false })).toBe('/ort/');
  });

  it('uses the Accurate-model bucket in production', () => {
    expect(wasmPrefixFrom({ modelBaseUrl: models, prod: true })).toBe(
      'https://pub-example.r2.dev/ort/',
    );
  });

  it('keeps the local runtime when no model bucket is configured', () => {
    expect(wasmPrefixFrom({ modelBaseUrl: null, prod: true })).toBe('/ort/');
  });

  it('lets an explicit runtime URL override the model bucket', () => {
    expect(
      wasmPrefixFrom({
        ortBaseUrl: 'https://cdn.example/runtime',
        modelBaseUrl: models,
        prod: true,
      }),
    ).toBe('https://cdn.example/runtime/');
  });
});
