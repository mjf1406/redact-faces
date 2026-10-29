import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { addStudent, assignFaces, confirmSuggestion, markFaces } from '../db/mutate';
import { clusterUnassigned } from '../scan/suggestions';
import { useUi } from './store';
import { VirtualGrid, VirtualRows } from './virtual';

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
    <section>
      <div className="row">
        <button
          type="button"
          aria-pressed={mode === 'clusters'}
          onClick={() => setMode('clusters')}
        >
          Clusters
        </button>
        <button
          type="button"
          aria-pressed={mode === 'suggested'}
          onClick={() => setMode('suggested')}
        >
          Suggested
        </button>
        <button type="button" aria-pressed={mode === 'review'} onClick={() => setMode('review')}>
          Needs review
        </button>
      </div>
      {mode === 'clusters' ? (
        <div className="list-frame tall">
          <VirtualGrid items={groups} height={640} width={960} columnWidth={300} rowHeight={430}>
            {(ids) => {
              const shown = ids
                .slice(0, 12)
                .map((id) => byId.get(id))
                .filter((face) => face != null);
              const chosen = ids.filter((id) => selected.includes(id));
              const target = chosen.length > 0 ? chosen : ids;
              return (
                <article className="cluster">
                  <p>
                    {ids.length} faces{chosen.length > 0 ? ` · ${chosen.length} selected` : ''}
                  </p>
                  <div className="crops">
                    {shown.map((face) => (
                      <button
                        type="button"
                        key={face.id}
                        className={selected.includes(face.id) ? 'crop selected' : 'crop'}
                        onClick={(event) => toggleSelected(face.id, event.shiftKey ? ids : null)}
                      >
                        {face.crop ? <Crop blob={face.crop} /> : <span>No crop</span>}
                      </button>
                    ))}
                  </div>
                  <input
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
                  <div className="row">
                    <button type="button" onClick={() => void markFaces(projectId, target, 'safe')}>
                      Not a student / OK to show
                    </button>
                    <button
                      type="button"
                      onClick={() => void markFaces(projectId, target, 'falsePositive')}
                    >
                      Not a face
                    </button>
                  </div>
                </article>
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
        <div>
          <label>
            Accept all at or above
            <input
              type="number"
              min={0.25}
              max={0.7}
              step={0.01}
              value={acceptAt}
              onChange={(event) => setAcceptAt(Number(event.target.value))}
            />
          </label>
          <p>
            {above.length} suggestions. Sample:{' '}
            {above
              .slice(0, 8)
              .map((face) => studentName(students, face.suggestedStudentId))
              .join(', ') || 'none'}
          </p>
          <button
            type="button"
            onClick={() =>
              void Promise.all(above.map((face) => confirmSuggestion(projectId, face.id)))
            }
          >
            Accept all above {acceptAt}
          </button>
          <div className="list-frame">
            <VirtualRows items={suggested} rowHeight={72} height={420}>
              {(face) => (
                <div className="list-row">
                  {face.crop ? <Crop blob={face.crop} /> : null}
                  <span>
                    {studentName(students, face.suggestedStudentId)} ·{' '}
                    {(face.suggestionScore ?? 0).toFixed(2)}
                  </span>
                  <button type="button" onClick={() => void confirmSuggestion(projectId, face.id)}>
                    Confirm
                  </button>
                </div>
              )}
            </VirtualRows>
          </div>
        </div>
      ) : null}
      {mode === 'review' ? (
        <div className="list-frame">
          <VirtualRows items={needsReview} rowHeight={64} height={480}>
            {(face) => (
              <div className="list-row">
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

function Crop({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url ? <img src={url} alt="" /> : null;
}
