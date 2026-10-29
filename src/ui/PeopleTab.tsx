import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db/db';
import { addStudent, deleteStudent, mergeStudents, renameStudent, setConsent } from '../db/mutate';
import type { Consent } from '../engine/constants';
import { parseRoster } from '../lib/roster';
import { VirtualRows } from './virtual';

export function PeopleTab({ projectId }: { projectId: string }) {
  const students = useLiveQuery(
    () => db.students.where('projectId').equals(projectId).sortBy('name'),
    [projectId],
  );
  const [name, setName] = useState('');
  const [roster, setRoster] = useState('');
  const [mergeA, setMergeA] = useState('');
  const [mergeB, setMergeB] = useState('');
  const rows = students ?? [];

  return (
    <section>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          void addStudent(projectId, name).then(() => setName(''));
        }}
      >
        <label>
          Add a student
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <button type="submit">Add</button>
      </form>
      <label>
        Paste roster, one name per line. Optional <code>, yes</code> or <code>, no</code>.
        <textarea value={roster} onChange={(event) => setRoster(event.target.value)} rows={5} />
      </label>
      <button
        type="button"
        onClick={() => {
          const parsed = parseRoster(roster);
          void Promise.all(parsed.map((row) => addStudent(projectId, row.name, row.consent))).then(
            () => setRoster(''),
          );
        }}
      >
        Add names
      </button>
      <div className="list-frame">
        <VirtualRows items={rows} rowHeight={64} height={420}>
          {(student) => (
            <div className="list-row">
              <input
                aria-label={`Name for ${student.name}`}
                defaultValue={student.name}
                onBlur={(event) => void renameStudent(student.id, event.target.value)}
              />
              {student.consent == null ? (
                <span className="chip">No consent set — treated as no</span>
              ) : null}
              <ConsentButtons
                consent={student.consent}
                onChange={(consent) => void setConsent(student.id, consent)}
              />
              <button type="button" onClick={() => void deleteStudent(student.id)}>
                Delete
              </button>
            </div>
          )}
        </VirtualRows>
      </div>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          void mergeStudents(projectId, mergeA, mergeB);
        }}
      >
        <label>
          Keep
          <select value={mergeA} onChange={(event) => setMergeA(event.target.value)}>
            <option value="">Choose</option>
            {rows.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Merge into them
          <select value={mergeB} onChange={(event) => setMergeB(event.target.value)}>
            <option value="">Choose</option>
            {rows.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={!mergeA || !mergeB}>
          Merge two students
        </button>
      </form>
    </section>
  );
}

function ConsentButtons({
  consent,
  onChange,
}: {
  consent: Consent;
  onChange: (consent: Consent) => void;
}) {
  return (
    <span className="row">
      {(['yes', 'no', null] as const).map((value) => (
        <button
          type="button"
          key={String(value)}
          aria-pressed={consent === value}
          onClick={() => onChange(value)}
        >
          {value ?? 'unset'}
        </button>
      ))}
    </span>
  );
}
