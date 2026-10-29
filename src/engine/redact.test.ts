import { describe, expect, it } from 'vitest';
import type { RedactFace, RedactStudent } from '../domain';
import { computeRedactionRects, redactionRect, shouldRedactFace } from './redact';

const photo = { width: 1000, height: 500 };
const settings = { redactionPadding: 0.35 };
const students: RedactStudent[] = [
  { id: 'yes', consent: 'yes' },
  { id: 'no', consent: 'no' },
  { id: 'unset', consent: null },
];

function face(overrides: Partial<RedactFace>): RedactFace {
  return {
    source: 'detector',
    state: 'unassigned',
    studentId: null,
    suggestedStudentId: null,
    box: { x: 0.2, y: 0.2, w: 0.1, h: 0.2 },
    kps: [],
    ...overrides,
  };
}

describe('redaction geometry', () => {
  it('pads, shifts up, and contains landmarks', () => {
    const rect = redactionRect(
      { x: 0.2, y: 0.2, w: 0.1, h: 0.2 },
      [{ x: 0.15, y: 0.2 }],
      1000,
      500,
      0.35,
    );
    expect(rect.x).toBeCloseTo(150);
    expect(rect.y).toBeCloseTo(57);
    expect(rect.w).toBeCloseTo(185);
    expect(rect.h).toBeCloseTo(170);
  });

  it('clamps to the image', () => {
    const rect = redactionRect({ x: 0, y: 0, w: 0.1, h: 0.1 }, [], 100, 100, 0.35);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
  });
});

describe('redaction rule', () => {
  const cases: { name: string; face: RedactFace; unresolved: boolean; redacts: boolean }[] = [
    {
      name: 'manual',
      face: face({ source: 'manual', state: 'confirmed' }),
      unresolved: false,
      redacts: true,
    },
    {
      name: 'confirmed no',
      face: face({ state: 'confirmed', studentId: 'no' }),
      unresolved: false,
      redacts: true,
    },
    {
      name: 'confirmed unset',
      face: face({ state: 'confirmed', studentId: 'unset' }),
      unresolved: false,
      redacts: true,
    },
    {
      name: 'confirmed yes',
      face: face({ state: 'confirmed', studentId: 'yes' }),
      unresolved: false,
      redacts: false,
    },
    {
      name: 'confirmed missing student',
      face: face({ state: 'confirmed', studentId: 'gone' }),
      unresolved: true,
      redacts: true,
    },
    {
      name: 'suggested no',
      face: face({ state: 'suggested', suggestedStudentId: 'no' }),
      unresolved: true,
      redacts: true,
    },
    {
      name: 'suggested yes',
      face: face({ state: 'suggested', suggestedStudentId: 'yes' }),
      unresolved: true,
      redacts: false,
    },
    { name: 'safe', face: face({ state: 'safe' }), unresolved: false, redacts: false },
    {
      name: 'false positive',
      face: face({ state: 'falsePositive' }),
      unresolved: false,
      redacts: false,
    },
    { name: 'unassigned', face: face({ state: 'unassigned' }), unresolved: true, redacts: false },
  ];

  it.each(cases)('$name', ({ face: sample, redacts }) => {
    expect(shouldRedactFace(sample, students, { redactUnresolved: false })).toBe(redacts);
  });

  it('blacks out unresolved faces only when asked', () => {
    const sample = face({ state: 'unassigned' });
    expect(shouldRedactFace(sample, students, { redactUnresolved: true })).toBe(true);
    const rects = computeRedactionRects(photo, [sample], students, settings, {
      redactUnresolved: true,
    });
    expect(rects).toHaveLength(1);
    const suggestedYes = face({ state: 'suggested', suggestedStudentId: 'yes' });
    expect(shouldRedactFace(suggestedYes, students, { redactUnresolved: true })).toBe(true);
  });
});
