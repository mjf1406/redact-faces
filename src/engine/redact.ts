import { REDACTION_SHIFT_UP, type NormPoint, type ProjectSettings } from './constants';
import type { RedactFace, RedactStudent } from '../domain';
import type { PixelRect } from './constants';

export type RedactOptions = { redactUnresolved: boolean };

export function isFaceResolved(
  face: Pick<RedactFace, 'state' | 'studentId'>,
  studentIds: ReadonlySet<string>,
) {
  if (face.state === 'safe' || face.state === 'falsePositive') return true;
  return face.state === 'confirmed' && !!face.studentId && studentIds.has(face.studentId);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function redactionRect(
  box: { x: number; y: number; w: number; h: number },
  kps: readonly NormPoint[],
  width: number,
  height: number,
  padding: number,
): PixelRect {
  const bx = box.x * width;
  const by = box.y * height;
  const bw = box.w * width;
  const bh = box.h * height;
  let x1 = bx - padding * bw;
  let y1 = by - padding * bh;
  let x2 = bx + bw + padding * bw;
  let y2 = by + bh + padding * bh;
  const shift = REDACTION_SHIFT_UP * bh;
  y1 -= shift;
  y2 -= shift;
  for (const point of kps) {
    const px = point.x * width;
    const py = point.y * height;
    x1 = Math.min(x1, px);
    y1 = Math.min(y1, py);
    x2 = Math.max(x2, px);
    y2 = Math.max(y2, py);
  }
  x1 = clamp(x1, 0, width);
  y1 = clamp(y1, 0, height);
  x2 = clamp(x2, 0, width);
  y2 = clamp(y2, 0, height);
  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}

function consentOf(students: readonly RedactStudent[], id: string | null) {
  if (!id) return null;
  return students.find((student) => student.id === id)?.consent ?? null;
}

export function shouldRedactFace(
  face: RedactFace,
  students: readonly RedactStudent[],
  opts: RedactOptions,
) {
  if (face.state === 'safe' || face.state === 'falsePositive') return false;
  if (face.source === 'manual') return true;
  if (face.state === 'confirmed') return consentOf(students, face.studentId) !== 'yes';
  if (face.state === 'suggested' && consentOf(students, face.suggestedStudentId) !== 'yes')
    return true;
  const studentIds = new Set(students.map((student) => student.id));
  return opts.redactUnresolved && !isFaceResolved(face, studentIds);
}

export function computeRedactionRects(
  photo: { width: number; height: number },
  faces: readonly RedactFace[],
  students: readonly RedactStudent[],
  settings: Pick<ProjectSettings, 'redactionPadding'>,
  opts: RedactOptions,
): PixelRect[] {
  const rects: PixelRect[] = [];
  for (const face of faces) {
    if (!shouldRedactFace(face, students, opts)) continue;
    rects.push(
      redactionRect(face.box, face.kps, photo.width, photo.height, settings.redactionPadding),
    );
  }
  return rects;
}

export function scaleRects(rects: readonly PixelRect[], scale: number): PixelRect[] {
  return rects.map((rect) => ({
    x: rect.x * scale,
    y: rect.y * scale,
    w: rect.w * scale,
    h: rect.h * scale,
  }));
}
