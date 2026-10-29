import { describe, expect, it } from 'vitest';
import { parseBackup } from '../db/backup';
import { defaultSettings } from './constants';
import { canExport, canOverrideExport } from './exportGate';
import { assertOutputOutsideSource, type DirLike } from './folderGuard';

function dir(name: string, parent?: DirLike): DirLike {
  const self: DirLike = {
    isSameEntry: async (other) => other === self,
    resolve: async (other) => {
      if (other === self) return [];
      if (parent && other === parent) return null;
      return null;
    },
  };
  if (parent?.resolve) {
    const parentResolve = parent.resolve.bind(parent);
    parent.resolve = async (other) => {
      if (other === self) return [name];
      return parentResolve(other);
    };
  }
  return self;
}

describe('export gate', () => {
  const students = [{ id: 's1' }];
  it('blocks unresolved faces and photos that are not done', () => {
    expect(
      canExport({
        photos: [{ id: 'p', status: 'done' }],
        faces: [{ id: 'f', state: 'unassigned', studentId: null }],
        students,
      }),
    ).toBe(false);
    expect(
      canOverrideExport({
        photos: [{ id: 'p', status: 'done' }],
        faces: [{ id: 'f', state: 'unassigned', studentId: null }],
        students,
      }),
    ).toBe(true);
    expect(
      canOverrideExport({
        photos: [{ id: 'p', status: 'error' }],
        faces: [{ id: 'f', state: 'safe', studentId: null }],
        students,
      }),
    ).toBe(false);
  });

  it('allows export when every face is resolved and every photo is done', () => {
    expect(
      canExport({
        photos: [{ id: 'p', status: 'done' }],
        faces: [{ id: 'f', state: 'confirmed', studentId: 's1' }],
        students,
      }),
    ).toBe(true);
  });
});

describe('output folder guard', () => {
  it('refuses the source folder, a child of it, and a parent of it', async () => {
    const source = dir('source');
    const child = dir('out', source);
    const parent = dir('parent');
    const nestedSource = dir('source', parent);
    await expect(assertOutputOutsideSource(source, source)).rejects.toThrow(/source folder/);
    await expect(assertOutputOutsideSource(source, child)).rejects.toThrow(/inside the source/);
    await expect(assertOutputOutsideSource(nestedSource, parent)).rejects.toThrow(
      /inside the output/,
    );
  });
});

describe('backup schema', () => {
  it('accepts a round trip and rejects a bad file', () => {
    const backup = {
      version: 1 as const,
      project: { name: '2026', modelPack: 'fast' as const, settings: defaultSettings() },
      students: [{ id: 's', name: 'Ada', consent: 'yes' as const }],
      photos: [
        {
          relPath: 'a.jpg',
          size: 10,
          lastModified: 1,
          width: 20,
          height: 10,
          faces: [
            {
              box: { x: 0, y: 0, w: 1, h: 1 },
              kps: [],
              score: 1,
              lowConfidence: false,
              source: 'manual' as const,
              state: 'confirmed' as const,
              studentId: null,
            },
          ],
        },
      ],
    };
    expect(parseBackup(backup).success).toBe(true);
    expect(parseBackup({ ...backup, version: 2 }).success).toBe(false);
    expect(
      parseBackup({ ...backup, students: [{ id: 's', name: 'Ada', consent: 'maybe' }] }).success,
    ).toBe(false);
  });
});
