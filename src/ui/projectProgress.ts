import type { Consent, FaceState, PhotoStatus } from '../engine/constants';
import { isFaceResolved } from '../engine/redact';
import { FLOW_STEPS, type FlowStep } from './steps';

export type StepStatus = 'not-started' | 'in-progress' | 'done' | 'ready';

export type StepProgress = {
  id: FlowStep;
  status: StepStatus;
  value: number;
  detail: string;
};

export type ProgressPhoto = { status: PhotoStatus };
export type ProgressFace = { state: FaceState; studentId: string | null };
export type ProgressStudent = { id: string; consent: Consent };

export type ProgressInput = {
  hasFolder: boolean;
  photos: readonly ProgressPhoto[];
  faces: readonly ProgressFace[];
  students: readonly ProgressStudent[];
};

function percent(done: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

function count(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function photoProgress(input: ProgressInput): Omit<StepProgress, 'id'> {
  const total = input.photos.length;
  const done = input.photos.filter((photo) => photo.status === 'done').length;
  const failed = input.photos.filter((photo) => photo.status === 'error').length;
  const unsupported = input.photos.filter((photo) => photo.status === 'unsupported').length;
  const waiting = total - done - failed - unsupported;
  if (total === 0) {
    return {
      status: 'not-started',
      value: 0,
      detail: input.hasFolder ? 'Start the scan' : 'Choose a photo folder',
    };
  }
  const complete = waiting === 0 && failed === 0 && done > 0;
  let detail = `${done} of ${total} scanned`;
  if (failed > 0) detail = `${detail}. ${count(failed, 'photo failed', 'photos failed')}`;
  else if (complete && unsupported > 0)
    detail = `${count(done, 'photo', 'photos')} scanned. ${count(unsupported, 'photo', 'photos')} cannot be read`;
  else if (complete) detail = `${count(done, 'photo', 'photos')} scanned`;
  return {
    status: complete ? 'done' : done > 0 || failed > 0 ? 'in-progress' : 'not-started',
    value: percent(done, total),
    detail,
  };
}

function scanFinished(input: ProgressInput) {
  if (input.photos.length === 0) return false;
  const done = input.photos.filter((photo) => photo.status === 'done').length;
  const failed = input.photos.filter((photo) => photo.status === 'error').length;
  const unsupported = input.photos.filter((photo) => photo.status === 'unsupported').length;
  const waiting = input.photos.length - done - failed - unsupported;
  return waiting === 0 && failed === 0 && done > 0;
}

function nameProgress(input: ProgressInput): Omit<StepProgress, 'id'> {
  const faces = input.faces;
  if (faces.length === 0) {
    return scanFinished(input)
      ? { status: 'done', value: 100, detail: 'No faces to name' }
      : { status: 'not-started', value: 0, detail: 'Scan the photos first' };
  }
  const unassigned = faces.filter((face) => face.state === 'unassigned').length;
  if (unassigned === 0) {
    return { status: 'done', value: 100, detail: 'Every group has a name' };
  }
  return {
    status: 'in-progress',
    value: percent(faces.length - unassigned, faces.length),
    detail:
      unassigned === 1 ? '1 face still needs a name' : `${unassigned} faces still need a name`,
  };
}

function guessProgress(input: ProgressInput): Omit<StepProgress, 'id'> {
  const faces = input.faces;
  const suggested = faces.filter((face) => face.state === 'suggested').length;
  const checked = faces.filter(
    (face) => face.state === 'confirmed' || face.state === 'safe' || face.state === 'falsePositive',
  ).length;
  if (suggested === 0 && checked === 0) {
    return faces.length === 0 && scanFinished(input)
      ? { status: 'done', value: 100, detail: 'No guesses to check' }
      : { status: 'not-started', value: 0, detail: 'Name a group first' };
  }
  if (suggested === 0) {
    return { status: 'done', value: 100, detail: 'No guesses to check' };
  }
  return {
    status: 'in-progress',
    value: percent(checked, checked + suggested),
    detail: suggested === 1 ? '1 guess to check' : `${suggested} guesses to check`,
  };
}

function permissionProgress(input: ProgressInput): Omit<StepProgress, 'id'> {
  const students = input.students;
  if (students.length === 0) {
    return input.faces.length === 0 && scanFinished(input)
      ? { status: 'done', value: 100, detail: 'No one to ask' }
      : { status: 'not-started', value: 0, detail: 'Name a group first' };
  }
  const chosen = students.filter(
    (student) => student.consent === 'yes' || student.consent === 'no',
  ).length;
  if (chosen === students.length) {
    return { status: 'done', value: 100, detail: 'Everyone has a yes or no' };
  }
  const verb = chosen === 1 ? 'has' : 'have';
  return {
    status: chosen === 0 ? 'not-started' : 'in-progress',
    value: percent(chosen, students.length),
    detail: `${chosen} of ${students.length} ${verb} a yes or no`,
  };
}

function reviewProgress(input: ProgressInput): Omit<StepProgress, 'id'> {
  const faces = input.faces;
  const students = input.students;
  if (faces.length === 0) {
    return scanFinished(input)
      ? { status: 'done', value: 100, detail: 'No faces to check' }
      : { status: 'not-started', value: 0, detail: 'Scan the photos first' };
  }
  const studentIds = new Set(students.map((student) => student.id));
  const resolved = faces.filter((face) => isFaceResolved(face, studentIds)).length;
  const open = faces.length - resolved;
  if (open === 0) {
    return { status: 'done', value: 100, detail: 'Every face is resolved' };
  }
  return {
    status: resolved === 0 ? 'not-started' : 'in-progress',
    value: percent(resolved, faces.length),
    detail: open === 1 ? '1 face still to check' : `${open} faces still to check`,
  };
}

function exportProgress(input: ProgressInput): Omit<StepProgress, 'id'> {
  const total = input.photos.length;
  if (total === 0) {
    return { status: 'not-started', value: 0, detail: 'Scan the photos first' };
  }
  const done = input.photos.filter((photo) => photo.status === 'done').length;
  const studentIds = new Set(input.students.map((student) => student.id));
  const unresolved = input.faces.filter((face) => !isFaceResolved(face, studentIds)).length;
  const photosNotDone = total - done;
  if (photosNotDone === 0 && unresolved === 0 && done > 0) {
    return {
      status: 'ready',
      value: 100,
      detail: input.faces.length === 0 ? 'No faces were found' : 'Ready to save the copies',
    };
  }
  const photoText =
    photosNotDone === 0
      ? null
      : photosNotDone === 1
        ? '1 photo is not scanned'
        : `${photosNotDone} photos are not scanned`;
  const faceText =
    unresolved === 0
      ? null
      : unresolved === 1
        ? '1 face is still open'
        : `${unresolved} faces are still open`;
  const detail = [photoText, faceText].filter(Boolean).join('. ');
  const faceValue =
    input.faces.length === 0 ? 0 : percent(input.faces.length - unresolved, input.faces.length);
  const value =
    input.faces.length === 0
      ? percent(done, total)
      : Math.round((percent(done, total) + faceValue) / 2);
  return {
    status: done === 0 && unresolved === input.faces.length ? 'not-started' : 'in-progress',
    value,
    detail,
  };
}

const builders: Record<FlowStep, (input: ProgressInput) => Omit<StepProgress, 'id'>> = {
  photos: photoProgress,
  names: nameProgress,
  guesses: guessProgress,
  permission: permissionProgress,
  review: reviewProgress,
  export: exportProgress,
};

export function projectStepProgress(input: ProgressInput): StepProgress[] {
  return FLOW_STEPS.map((step) => ({ id: step.id, ...builders[step.id](input) }));
}

export function wizardStartStep(steps: readonly StepProgress[]): FlowStep {
  const open = steps.find((step) => step.status !== 'done' && step.status !== 'ready');
  return open?.id ?? steps.find((step) => step.status === 'ready')?.id ?? 'photos';
}
