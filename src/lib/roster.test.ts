import { describe, expect, it } from 'vitest';
import { parseRoster } from './roster';

describe('parseRoster', () => {
  it('reads names and an optional consent column', () => {
    expect(parseRoster('Ada Lovelace, yes\nAlan Turing, no\nGrace Hopper\n\n')).toEqual([
      { name: 'Ada Lovelace', consent: 'yes' },
      { name: 'Alan Turing', consent: 'no' },
      { name: 'Grace Hopper', consent: null },
    ]);
  });

  it('keeps a comma that is not a consent value', () => {
    expect(parseRoster('Hopper, Grace')).toEqual([{ name: 'Hopper, Grace', consent: null }]);
  });
});
