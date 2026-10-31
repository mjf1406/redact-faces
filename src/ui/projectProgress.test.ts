import { describe, expect, it } from 'vitest';
import { projectStepProgress, wizardStartStep, type ProgressInput } from './projectProgress';

function input(patch: Partial<ProgressInput> = {}): ProgressInput {
  return {
    hasFolder: false,
    photos: [],
    faces: [],
    students: [],
    ...patch,
  };
}

function step(steps: ReturnType<typeof projectStepProgress>, id: string) {
  const found = steps.find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

describe('project step progress', () => {
  it('starts every step empty', () => {
    const steps = projectStepProgress(input());
    expect(steps.map((item) => item.status)).toEqual([
      'not-started',
      'not-started',
      'not-started',
      'not-started',
      'not-started',
      'not-started',
    ]);
    expect(step(steps, 'photos').detail).toBe('Choose a photo folder');
    expect(wizardStartStep(steps)).toBe('photos');
  });

  it('counts a partial scan and leaves later steps waiting', () => {
    const steps = projectStepProgress(
      input({
        hasFolder: true,
        photos: [
          { status: 'done' },
          { status: 'done' },
          { status: 'pending' },
          { status: 'error' },
        ],
        faces: [
          { state: 'unassigned', studentId: null },
          { state: 'unassigned', studentId: null },
        ],
      }),
    );
    expect(step(steps, 'photos')).toMatchObject({
      status: 'in-progress',
      value: 50,
      detail: '2 of 4 scanned. 1 photo failed',
    });
    expect(step(steps, 'names').detail).toBe('2 faces still need a name');
    expect(wizardStartStep(steps)).toBe('photos');
  });

  it('moves through names, guesses, and permission', () => {
    const steps = projectStepProgress(
      input({
        hasFolder: true,
        photos: [{ status: 'done' }, { status: 'done' }],
        faces: [
          { state: 'confirmed', studentId: 'a' },
          { state: 'suggested', studentId: null },
          { state: 'safe', studentId: null },
        ],
        students: [
          { id: 'a', consent: 'yes' },
          { id: 'b', consent: null },
        ],
      }),
    );
    expect(step(steps, 'photos').status).toBe('done');
    expect(step(steps, 'names')).toMatchObject({
      status: 'done',
      detail: 'Every group has a name',
    });
    expect(step(steps, 'guesses')).toMatchObject({
      status: 'in-progress',
      detail: '1 guess to check',
    });
    expect(step(steps, 'permission').detail).toBe('1 of 2 has a yes or no');
    expect(step(steps, 'review').status).toBe('in-progress');
    expect(wizardStartStep(steps)).toBe('guesses');
  });

  it('marks save ready when every photo is scanned and every face is resolved', () => {
    const steps = projectStepProgress(
      input({
        hasFolder: true,
        photos: [{ status: 'done' }],
        faces: [{ state: 'confirmed', studentId: 'a' }],
        students: [{ id: 'a', consent: 'no' }],
      }),
    );
    expect(step(steps, 'review').status).toBe('done');
    expect(step(steps, 'permission').status).toBe('done');
    expect(step(steps, 'export')).toMatchObject({
      status: 'ready',
      value: 100,
      detail: 'Ready to save the copies',
    });
    expect(wizardStartStep(steps)).toBe('export');
  });
});
