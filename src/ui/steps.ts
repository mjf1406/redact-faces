export type FlowStep = 'photos' | 'names' | 'guesses' | 'permission' | 'review' | 'export';

export const FLOW_STEPS: { id: FlowStep; label: string; title: string; help: string }[] = [
  {
    id: 'photos',
    label: 'Photos',
    title: 'Choose the class photos',
    help: 'Pick the folder, then start the scan. The first scan downloads the face model and can take a while.',
  },
  {
    id: 'names',
    label: 'Names',
    title: 'Name each group',
    help: 'Each group looks like one person. Type their name. If a face is someone else, click it and choose Wrong student.',
  },
  {
    id: 'guesses',
    label: 'Check',
    title: 'Check the guesses',
    help: 'Say yes if the name is right. If it is the wrong student, leave the face as its own group or move it to someone else.',
  },
  {
    id: 'permission',
    label: 'Permission',
    title: 'Who can be shown',
    help: 'Yes means this person stays visible. No, or no choice, means the face is blacked out.',
  },
  {
    id: 'review',
    label: 'Review',
    title: 'Check every photo',
    help: 'Look through the photos before you save. You are responsible for the final check.',
  },
  {
    id: 'export',
    label: 'Save',
    title: 'Save the copies',
    help: 'This downloads a zip of new photos. The originals are not changed.',
  },
];
