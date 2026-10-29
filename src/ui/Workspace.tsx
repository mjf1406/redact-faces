import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { releaseProjectLock } from '../db/locks';
import { LICENSE_NOTICE, RESPONSIBILITY } from '../gate/copy';
import { ExportTab } from './ExportTab';
import { LabelTab } from './LabelTab';
import { PeopleTab } from './PeopleTab';
import { PhotosTab } from './PhotosTab';
import { ReviewTab } from './ReviewTab';
import { SettingsTab } from './SettingsTab';
import { useUi, type TabId } from './store';

const TABS: { id: TabId; label: string }[] = [
  { id: 'photos', label: 'Photos' },
  { id: 'people', label: 'People' },
  { id: 'label', label: 'Label' },
  { id: 'review', label: 'Review' },
  { id: 'export', label: 'Export' },
  { id: 'settings', label: 'Settings' },
];

export function Workspace({ projectId }: { projectId: string }) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const tab = useUi((state) => state.tab);
  const setTab = useUi((state) => state.setTab);
  const setProject = useUi((state) => state.setProject);
  const deviceLost = useUi((state) => state.deviceLost);
  const warnSlow = useUi((state) => state.warnSlow);
  const medianMs = useUi((state) => state.medianMs);

  return (
    <main className="page">
      <header className="top">
        <div>
          <p className="brand">Redact Faces</p>
          <h1>{project?.name ?? 'Project'}</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            releaseProjectLock(projectId);
            setProject(null);
          }}
        >
          All projects
        </button>
      </header>
      <p className="responsibility">{RESPONSIBILITY}</p>
      {warnSlow ? (
        <p className="banner">
          This GPU is usable, but a test pass took {Math.round(medianMs ?? 0)} ms. Large folders
          will be slow.
        </p>
      ) : null}
      {deviceLost ? (
        <p className="banner danger">
          The graphics device was lost. The scan stopped. {deviceLost}{' '}
          <button type="button" onClick={() => location.reload()}>
            Restart engine
          </button>
        </p>
      ) : null}
      <nav className="tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {tab === 'photos' ? <PhotosTab projectId={projectId} /> : null}
      {tab === 'people' ? <PeopleTab projectId={projectId} /> : null}
      {tab === 'label' ? <LabelTab projectId={projectId} /> : null}
      {tab === 'review' ? <ReviewTab projectId={projectId} /> : null}
      {tab === 'export' ? <ExportTab projectId={projectId} /> : null}
      {tab === 'settings' ? <SettingsTab projectId={projectId} /> : null}
      <footer className="legal">
        <p>{LICENSE_NOTICE}</p>
      </footer>
    </main>
  );
}
