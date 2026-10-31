import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { db } from '../db/db';
import { addStudent, assignFaces, markFaces } from '../db/mutate';
import { loadLabelGroups } from '../scan/suggestions';
import { Crop } from './crop';
import { WrongStudent } from './WrongStudent';

export function NameStep({ projectId }: { projectId: string }) {
  const faces =
    useLiveQuery(() => db.faces.where('projectId').equals(projectId).toArray(), [projectId]) ?? [];
  const students =
    useLiveQuery(
      () => db.students.where('projectId').equals(projectId).sortBy('name'),
      [projectId],
    ) ?? [];
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const [groups, setGroups] = useState<string[][]>([]);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const signature = faces
    .filter((face) => face.state === 'unassigned')
    .map((face) => `${face.id}:${face.bundleId ?? ''}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;
    void loadLabelGroups(projectId)
      .then((next) => {
        if (!cancelled) {
          setGroups(next);
          setReady(true);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : 'Could not group faces.');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, signature, project?.settings.clusterThreshold]);

  const safeIndex = Math.min(index, Math.max(0, groups.length - 1));
  const ids = groups[safeIndex] ?? [];
  const chosen = selected.filter((id) => ids.includes(id));
  const naming = ids.filter((id) => !chosen.includes(id));
  const byId = new Map(faces.map((face) => [face.id, face]));

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || naming.length === 0) return;
    const existing = students.find(
      (student) => student.name.toLowerCase() === trimmed.toLowerCase(),
    );
    const studentId = existing?.id ?? (await addStudent(projectId, trimmed));
    await assignFaces(projectId, naming, studentId);
    setName('');
    setSelected([]);
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!ready) return <p className="text-sm text-muted-foreground">Grouping faces…</p>;
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {faces.length === 0
          ? 'Scan the photos first. Then each group of similar faces shows up here.'
          : 'Every group has a name. Continue to check the guesses.'}
      </p>
    );
  }

  return (
    <Card>
      <CardContent className="grid gap-4">
        <p className="text-sm">
          Group {safeIndex + 1} of {groups.length}
        </p>
        <p className="text-sm">
          {ids.length === 1
            ? 'One face is left on its own.'
            : `These ${ids.length} faces look like the same person.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {ids.map((id) => {
            const face = byId.get(id);
            if (!face) return null;
            const marked = chosen.includes(id);
            return (
              <Button
                type="button"
                key={id}
                variant="outline"
                aria-pressed={marked}
                className={cn('size-28 overflow-hidden p-0', marked && 'ring-2 ring-destructive')}
                onClick={() =>
                  setSelected((current) =>
                    current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
                  )
                }
              >
                {face.crop ? <Crop blob={face.crop} /> : <span>No crop</span>}
              </Button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          Click a face that is a different person, then choose Wrong student.
        </p>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void saveName();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="student-name">Name</Label>
            <Input
              id="student-name"
              value={name}
              list="student-names"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!name.trim() || naming.length === 0}>
              {chosen.length > 0 ? `Save name for the other ${naming.length}` : 'Save name'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={naming.length === 0}
              onClick={() => void markFaces(projectId, naming, 'safe')}
            >
              OK to show
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={naming.length === 0}
              onClick={() => void markFaces(projectId, naming, 'falsePositive')}
            >
              Not a face
            </Button>
          </div>
        </form>
        <WrongStudent
          key={chosen.join('|') || 'none'}
          projectId={projectId}
          faceIds={chosen}
          wrongStudentId={null}
          students={students}
          disabled={chosen.length === 0}
          onDone={() => setSelected([])}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={safeIndex <= 0}
            onClick={() => setIndex(safeIndex - 1)}
          >
            Previous group
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={safeIndex >= groups.length - 1}
            onClick={() => setIndex(safeIndex + 1)}
          >
            Next group
          </Button>
        </div>
        <datalist id="student-names">
          {students.map((student) => (
            <option key={student.id} value={student.name} />
          ))}
        </datalist>
      </CardContent>
    </Card>
  );
}
