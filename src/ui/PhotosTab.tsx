import { useLiveQuery } from 'dexie-react-hooks';
import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void chooseFolder()}>
          Choose photo folder
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void reconnect()}
          disabled={!project?.dirHandle}
        >
          Reconnect folder
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void scanProject(projectId)}
          disabled={!project?.dirHandle || scan.running}
        >
          Start scan
        </Button>
        <Button type="button" variant="outline" onClick={pauseScan} disabled={!scan.running}>
          {scan.paused ? 'Resume' : 'Pause'}
        </Button>
        <Button type="button" variant="outline" onClick={cancelScan} disabled={!scan.running}>
          Cancel
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {scan.done} / {scan.total} {scan.current ? `· ${scan.current}` : ''}
      </p>
      {scan.total > 0 ? <Progress value={(scan.done / scan.total) * 100} /> : null}
      {scan.message ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{scan.message}</AlertDescription>
        </Alert>
      ) : null}
      <h3 className="font-heading text-base font-medium">Needs attention</h3>
      {problems.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No problems. When the scan finishes, continue and name each group.
        </p>
      ) : (
        <div className="h-[360px]">
          <VirtualRows items={problems} rowHeight={72} height={360}>
            {(photo) => (
              <div className="flex h-full flex-wrap items-center gap-2 pr-2">
                <span className="text-sm">
                  {photo.relPath} — {photo.status}. {photo.error}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void db.photos.update(photo.id, { status: 'pending', error: null })
                  }
                >
                  Retry
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    void db.transaction('rw', db.photos, db.faces, async () => {
                      await db.faces.where('photoId').equals(photo.id).delete();
                      await db.photos.delete(photo.id);
                    })
                  }
                >
                  Remove from project
                </Button>
              </div>
            )}
          </VirtualRows>
        </div>
      )}
    </section>
  );
}
