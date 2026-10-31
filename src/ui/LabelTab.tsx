import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { db } from '../db/db';
import { addStudent, assignFaces, confirmSuggestion, markFaces } from '../db/mutate';
import { clusterUnassigned } from '../scan/suggestions';
import { useUi } from './store';
import { Crop } from './crop';
import { VirtualGrid, VirtualRows } from './virtual';

const pressed =
  'aria-pressed:bg-primary aria-pressed:text-primary-foreground hover:aria-pressed:bg-primary/80';

export function LabelTab({ projectId }: { projectId: string }) {
  const faces =
    useLiveQuery(() => db.faces.where('projectId').equals(projectId).toArray(), [projectId]) ?? [];
  const students =
    useLiveQuery(
      () => db.students.where('projectId').equals(projectId).sortBy('name'),
      [projectId],
    ) ?? [];
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const [groups, setGroups] = useState<string[][]>([]);
  const [mode, setMode] = useState<'clusters' | 'suggested' | 'review'>('clusters');
  const [acceptAt, setAcceptAt] = useState(0.55);
  const selected = useUi((state) => state.selectedFaceIds);
  const toggleSelected = useUi((state) => state.toggleSelected);
  const clearSelected = useUi((state) => state.clearSelected);
  const signature = faces
    .filter((face) => face.state === 'unassigned')
    .map((face) => face.id)
    .join('|');

  useEffect(() => {
    let cancelled = false;
    void clusterUnassigned(projectId).then((next) => {
      if (!cancelled) setGroups(next);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, signature, project?.settings.clusterThreshold]);

  const byId = new Map(faces.map((face) => [face.id, face]));
  const suggested = faces.filter((face) => face.state === 'suggested');
  const needsReview = faces.filter(
    (face) =>
      face.state === 'unassigned' ||
      face.state === 'suggested' ||
      (face.lowConfidence && face.state !== 'safe' && face.state !== 'falsePositive'),
  );
  const above = suggested.filter((face) => (face.suggestionScore ?? 0) >= acceptAt);

  async function nameGroup(ids: string[], raw: string) {
    const name = raw.trim();
    if (!name || ids.length === 0) return;
    const existing = students.find((student) => student.name.toLowerCase() === name.toLowerCase());
    const studentId = existing?.id ?? (await addStudent(projectId, name));
    await assignFaces(projectId, ids, studentId);
    clearSelected();
  }

  return (
    <section className="grid gap-4">
      <ToggleGroup
        variant="outline"
        value={[mode]}
        onValueChange={(values) => {
          const next = values[0];
          if (next === 'clusters' || next === 'suggested' || next === 'review') setMode(next);
        }}
      >
        <ToggleGroupItem value="clusters" className={pressed}>
          Clusters
        </ToggleGroupItem>
        <ToggleGroupItem value="suggested" className={pressed}>
          Suggested
        </ToggleGroupItem>
        <ToggleGroupItem value="review" className={pressed}>
          Needs review
        </ToggleGroupItem>
      </ToggleGroup>
      {mode === 'clusters' ? (
        <div className="h-[640px]">
          <VirtualGrid items={groups} height={640} width={960} columnWidth={300} rowHeight={430}>
            {(ids) => {
              const shown = ids
                .slice(0, 12)
                .map((id) => byId.get(id))
                .filter((face) => face != null);
              const chosen = ids.filter((id) => selected.includes(id));
              const target = chosen.length > 0 ? chosen : ids;
              return (
                <Card className="m-1">
                  <CardContent className="grid gap-2">
                    <p className="text-sm">
                      {ids.length} faces{chosen.length > 0 ? ` · ${chosen.length} selected` : ''}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {shown.map((face) => (
                        <Button
                          type="button"
                          key={face.id}
                          variant="outline"
                          className={cn(
                            'size-16 overflow-hidden p-0',
                            selected.includes(face.id) && 'ring-2 ring-primary',
                          )}
                          onClick={(event) => toggleSelected(face.id, event.shiftKey ? ids : null)}
                        >
                          {face.crop ? <Crop blob={face.crop} /> : <span>No crop</span>}
                        </Button>
                      ))}
                    </div>
                    <Input
                      list="student-names"
                      aria-label="Student name"
                      placeholder="Name, then Enter"
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        void nameGroup(target, event.currentTarget.value);
                        event.currentTarget.value = '';
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void markFaces(projectId, target, 'safe')}
                      >
                        Not a student / OK to show
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void markFaces(projectId, target, 'falsePositive')}
                      >
                        Not a face
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }}
          </VirtualGrid>
          <datalist id="student-names">
            {students.map((student) => (
              <option key={student.id} value={student.name} />
            ))}
          </datalist>
        </div>
      ) : null}
      {mode === 'suggested' ? (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="accept-at">Accept all at or above</Label>
            <Input
              id="accept-at"
              type="number"
              min={0.25}
              max={0.7}
              step={0.01}
              value={acceptAt}
              onChange={(event) => setAcceptAt(Number(event.target.value))}
            />
          </div>
          <p className="text-sm">
            {above.length} suggestions. Sample:{' '}
            {above
              .slice(0, 8)
              .map((face) => studentName(students, face.suggestedStudentId))
              .join(', ') || 'none'}
          </p>
          <div>
            <Button
              type="button"
              onClick={() =>
                void Promise.all(above.map((face) => confirmSuggestion(projectId, face.id)))
              }
            >
              Accept all above {acceptAt}
            </Button>
          </div>
          <div className="h-[420px]">
            <VirtualRows items={suggested} rowHeight={72} height={420}>
              {(face) => (
                <div className="flex h-full flex-wrap items-center gap-2">
                  {face.crop ? (
                    <div className="size-12 overflow-hidden rounded-md border">
                      <Crop blob={face.crop} />
                    </div>
                  ) : null}
                  <span className="text-sm">
                    {studentName(students, face.suggestedStudentId)} ·{' '}
                    {(face.suggestionScore ?? 0).toFixed(2)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void confirmSuggestion(projectId, face.id)}
                  >
                    Confirm
                  </Button>
                </div>
              )}
            </VirtualRows>
          </div>
        </div>
      ) : null}
      {mode === 'review' ? (
        <div className="h-[480px]">
          <VirtualRows items={needsReview} rowHeight={64} height={480}>
            {(face) => (
              <div className="flex h-full items-center text-sm">
                <span>
                  {face.state}
                  {face.lowConfidence ? ' · low confidence' : ''} · {face.score.toFixed(2)}
                </span>
              </div>
            )}
          </VirtualRows>
        </div>
      ) : null}
    </section>
  );
}

function studentName(students: { id: string; name: string }[], id: string | null) {
  return students.find((student) => student.id === id)?.name ?? 'Unknown';
}
