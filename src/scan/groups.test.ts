import { describe, expect, it } from 'vitest';
import { partitionUnassigned } from './groups';

describe('partitionUnassigned', () => {
  it('keeps a split group together and leaves confirmed faces out', () => {
    const parts = partitionUnassigned(
      [
        { id: 'a', state: 'unassigned', bundleId: 'bundle' },
        { id: 'b', state: 'unassigned', bundleId: 'bundle' },
        { id: 'c', state: 'unassigned' },
        { id: 'd', state: 'unassigned' },
        { id: 'e', state: 'confirmed' },
      ],
      new Set(['c']),
    );
    expect(parts.bundles).toEqual([['a', 'b']]);
    expect(parts.free).toEqual(['c']);
    expect(parts.leftover).toEqual(['d']);
  });
});
