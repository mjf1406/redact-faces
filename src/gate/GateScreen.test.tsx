// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GateScreen } from '../ui/GateScreen';
import { GATE_COPY } from './copy';
import { GATE_CODES } from './evaluate';

describe('gate screens', () => {
  afterEach(() => cleanup());

  it.each(GATE_CODES)('renders %s without a way to continue', (code) => {
    const view = render(
      <GateScreen
        code={code}
        errorText={code === 'SESSION_FAILED' ? 'model files missing' : null}
        diagnostics="{}"
      />,
    );
    expect(view.getByRole('heading', { name: GATE_COPY[code].headline })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Copy diagnostics' })).toBeTruthy();
    expect(view.queryByRole('button', { name: /continue|skip|anyway/i })).toBeNull();
  });
});
