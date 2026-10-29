import type { Consent, FaceState } from '../engine/constants';
import { createId } from '../lib/id';
import { refreshSuggestions } from '../scan/suggestions';
import { db } from './db';

export async function addStudent(projectId: string, name: string, consent: Consent = null) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Enter a name.');
  const id = createId();
  await db.students.add({ id, projectId, name: trimmed, consent });
  return id;
}

export async function setConsent(studentId: string, consent: Consent) {
  await db.students.update(studentId, { consent });
  const student = await db.students.get(studentId);
  if (student) await refreshSuggestions(student.projectId);
}

export async function renameStudent(studentId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.students.update(studentId, { name: trimmed });
}

export async function deleteStudent(studentId: string) {
  const student = await db.students.get(studentId);
  if (!student) return;
  await db.transaction('rw', db.students, db.faces, async () => {
    await db.students.delete(studentId);
    await db.faces.where('studentId').equals(studentId).modify({
      studentId: null,
      state: 'unassigned',
    });
  });
  await refreshSuggestions(student.projectId);
}

export async function mergeStudents(projectId: string, keepId: string, dropId: string) {
  if (keepId === dropId) return;
  await db.transaction('rw', db.students, db.faces, async () => {
    await db.faces.where('studentId').equals(dropId).modify({ studentId: keepId });
    await db.faces
      .where('suggestedStudentId')
      .equals(dropId)
      .modify({ suggestedStudentId: keepId });
    await db.students.delete(dropId);
  });
  await refreshSuggestions(projectId);
}

export async function assignFaces(projectId: string, faceIds: string[], studentId: string) {
  await db.transaction('rw', db.faces, async () => {
    for (const id of faceIds) {
      await db.faces.update(id, {
        state: 'confirmed',
        studentId,
        suggestedStudentId: null,
        suggestionScore: null,
      });
    }
  });
  await refreshSuggestions(projectId);
}

export async function markFaces(
  projectId: string,
  faceIds: string[],
  state: Extract<FaceState, 'safe' | 'falsePositive'>,
) {
  await db.transaction('rw', db.faces, async () => {
    for (const id of faceIds) {
      await db.faces.update(id, {
        state,
        studentId: null,
        suggestedStudentId: null,
        suggestionScore: null,
      });
    }
  });
  await refreshSuggestions(projectId);
}

export async function confirmSuggestion(projectId: string, faceId: string) {
  const face = await db.faces.get(faceId);
  if (!face?.suggestedStudentId) return;
  await assignFaces(projectId, [faceId], face.suggestedStudentId);
}

export async function addManualRegion(
  projectId: string,
  photoId: string,
  box: { x: number; y: number; w: number; h: number },
) {
  await db.faces.add({
    id: createId(),
    projectId,
    photoId,
    box,
    kps: [],
    score: 1,
    lowConfidence: false,
    embedding: null,
    embModel: null,
    crop: null,
    state: 'confirmed',
    studentId: null,
    suggestedStudentId: null,
    suggestionScore: null,
    source: 'manual',
  });
}
