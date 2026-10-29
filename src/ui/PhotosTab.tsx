import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { readPermission } from '../lib/files';
import { cancelScan, pauseScan, scanProject } from '../scan/runScan';
import { useUi } from './store';
import { VirtualRows } from './virtual';

export function PhotosTab({ projectId }: { projectId: string }) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const photos = useLiveQuery(
    () => db.photos.where('projectId').equals(projectId).toArray(),
    [projectId],
  );
  const scan = useUi((state) => state.scan);
  const problems = (photos ?? []).filter(
    (photo) => photo.status === 'error' || photo.status === 'unsupported',
  );

  async function chooseFolder() {
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    await db.projects.update(projectId, { dirHandle: handle });
  }

  async function reconnect() {
    if (!project?.dirHandle) return;
    await readPermission(project.dirHandle);
  }

  return (
    <section>
      <div className="row">
        <button type="button" onClick={() => void chooseFolder()}>
          Choose photo folder
        </button>
        <button type="button" onClick={() => void reconnect()} disabled={!project?.dirHandle}>
          Reconnect folder
        </button>
        <button
          type="button"
          onClick={() => void scanProject(projectId)}
          disabled={!project?.dirHandle || scan.running}
        >
          Start scan
        </button>
        <button type="button" onClick={pauseScan} disabled={!scan.running}>
          {scan.paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" onClick={cancelScan} disabled={!scan.running}>
          Cancel
        </button>
      </div>
      <p>
        {scan.done} / {scan.total} {scan.current ? `· ${scan.current}` : ''}
      </p>
      {scan.message ? <p className="banner danger">{scan.message}</p> : null}
      <h2>Needs attention</h2>
      <div className="list-frame">
        <VirtualRows items={problems} rowHeight={72} height={360}>
          {(photo) => (
            <div className="list-row">
              <span>
                {photo.relPath} — {photo.status}. {photo.error}
              </span>
              <button
                type="button"
                onClick={() => void db.photos.update(photo.id, { status: 'pending', error: null })}
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() =>
                  void db.transaction('rw', db.photos, db.faces, async () => {
                    await db.faces.where('photoId').equals(photo.id).delete();
                    await db.photos.delete(photo.id);
                  })
                }
              >
                Remove from project
              </button>
            </div>
          )}
        </VirtualRows>
      </div>
    </section>
  );
}
