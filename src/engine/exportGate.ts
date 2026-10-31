import type { FaceState, PhotoStatus } from './constants';
import { isFaceResolved } from './redact';

export type GatePhoto = { id: string; status: PhotoStatus };
export type GateFace = { id: string; state: FaceState; studentId: string | null };
export type GateStudent = { id: string };

export function exportBlockers(input: {
  photos: readonly GatePhoto[];
  faces: readonly GateFace[];
  students: readonly GateStudent[];
}) {
  const studentIds = new Set(input.students.map((student) => student.id));
  return {
    unresolvedFaceIds: input.faces
      .filter((face) => !isFaceResolved(face, studentIds))
      .map((face) => face.id),
    photosNotDone: input.photos.filter((photo) => photo.status !== 'done').map((photo) => photo.id),
  };
}

export function canExport(input: {
  photos: readonly GatePhoto[];
  faces: readonly GateFace[];
  students: readonly GateStudent[];
}) {
  const blockers = exportBlockers(input);
  return blockers.unresolvedFaceIds.length === 0 && blockers.photosNotDone.length === 0;
}

export function canOverrideExport(input: {
  photos: readonly GatePhoto[];
  faces: readonly GateFace[];
  students: readonly GateStudent[];
}) {
  const blockers = exportBlockers(input);
  return blockers.photosNotDone.length === 0 && blockers.unresolvedFaceIds.length > 0;
}

export function allowExport(
  input: {
    photos: readonly GatePhoto[];
    faces: readonly GateFace[];
    students: readonly GateStudent[];
  },
  opts: { override: boolean },
) {
  if (opts.override) return canOverrideExport(input) || canExport(input);
  return canExport(input);
}
