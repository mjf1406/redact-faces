// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../engine/constants';

const project = { id: 'p1', name: 'Class 2026', settings: defaultSettings() };
const photos = [
  {
    id: 'photo1',
    relPath: 'a.jpg',
    status: 'done' as const,
    width: 100,
    height: 100,
    thumb: null,
  },
];
const faces = [
  {
    id: 'f1',
    photoId: 'photo1',
    state: 'unassigned' as const,
    studentId: null,
    source: 'detector' as const,
    suggestedStudentId: null,
    box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
    kps: [],
  },
];
const students = [{ id: 's1', consent: null }];

vi.mock('../db/db', () => ({ db: {} }));
vi.mock('../db/projects', () => ({ updateSettings: vi.fn() }));
vi.mock('../export/runExport', () => ({ runExport: vi.fn() }));
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (querier: () => unknown) => {
    const source = querier.toString();
    if (source.includes('db.projects')) return project;
    if (source.includes('db.photos')) return photos;
    if (source.includes('db.faces')) return faces;
    if (source.includes('db.students')) return students;
    return undefined;
  },
}));

import { runExport } from '../export/runExport';
import { ExportTab } from './ExportTab';

describe('export anyway', () => {
  afterEach(() => {
    cleanup();
    vi.mocked(runExport).mockReset();
  });

  it('shows the long-side option label', () => {
    const view = render(<ExportTab projectId="p1" />);
    expect(view.getByLabelText('Max long side').textContent).toContain('Original');
  });

  it('downloads a zip with unresolved faces visible and no folder picker', async () => {
    const picker = vi.fn();
    vi.stubGlobal('showDirectoryPicker', picker);
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
    vi.mocked(runExport).mockResolvedValue({
      exported: 1,
      facesRedacted: 0,
      skipped: [],
      cancelled: false,
      zip: new Blob(['zip'], { type: 'application/zip' }),
    });

    const view = render(<ExportTab projectId="p1" />);
    fireEvent.click(view.getByRole('button', { name: 'Download anyway…' }));

    expect(view.queryByLabelText('Type EXPORT')).toBeNull();
    expect(view.getByText(/They will not be blacked out/)).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: 'Download' }));

    await waitFor(() => expect(runExport).toHaveBeenCalled());
    expect(picker).not.toHaveBeenCalled();
    expect(downloads).toEqual(['Class 2026.zip']);
    expect(runExport).toHaveBeenCalledWith(
      'p1',
      { redactUnresolved: false, override: true },
      expect.any(Function),
      expect.any(Function),
    );
  });
});
