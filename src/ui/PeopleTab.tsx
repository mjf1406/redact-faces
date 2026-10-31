import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { db } from '../db/db';
import { addStudent, deleteStudent, mergeStudents, renameStudent, setConsent } from '../db/mutate';
import type { Consent } from '../engine/constants';
import { parseRoster } from '../lib/roster';
import { VirtualRows } from './virtual';

const pressed =
  'aria-pressed:bg-primary aria-pressed:text-primary-foreground hover:aria-pressed:bg-primary/80';

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
    <section className="grid gap-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void addStudent(projectId, name).then(() => setName(''));
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="add-student">Add a student</Label>
          <Input id="add-student" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <Button type="submit">Add</Button>
      </form>
      <div className="grid gap-2">
        <Label htmlFor="roster-paste">
          Paste roster, one name per line. Optional <code>, yes</code> or <code>, no</code>.
        </Label>
        <Textarea
          id="roster-paste"
          value={roster}
          onChange={(event) => setRoster(event.target.value)}
          rows={5}
        />
      </div>
      <div>
        <Button
          type="button"
          onClick={() => {
            const parsed = parseRoster(roster);
            void Promise.all(
              parsed.map((row) => addStudent(projectId, row.name, row.consent)),
            ).then(() => setRoster(''));
          }}
        >
          Add names
        </Button>
      </div>
      <div className="h-[420px]">
        <VirtualRows items={rows} rowHeight={64} height={420}>
          {(student) => (
            <div className="flex h-full flex-wrap items-center gap-2 pr-2">
              <Input
                aria-label={`Name for ${student.name}`}
                defaultValue={student.name}
                className="max-w-48"
                onBlur={(event) => void renameStudent(student.id, event.target.value)}
              />
              {student.consent == null ? (
                <Badge variant="outline">No consent set — treated as no</Badge>
              ) : null}
              <ConsentButtons
                consent={student.consent}
                onChange={(consent) => void setConsent(student.id, consent)}
              />
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => void deleteStudent(student.id)}
              >
                Delete
              </Button>
            </div>
          )}
        </VirtualRows>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void mergeStudents(projectId, mergeA, mergeB);
        }}
      >
        <StudentPick
          id="people-keep"
          label="Keep"
          value={mergeA}
          onChange={setMergeA}
          rows={rows}
        />
        <StudentPick
          id="people-merge"
          label="Merge into them"
          value={mergeB}
          onChange={setMergeB}
          rows={rows}
        />
        <Button type="submit" disabled={!mergeA || !mergeB}>
          Merge two students
        </Button>
      </form>
    </section>
  );
}

function StudentPick({
  id,
  label,
  value,
  onChange,
  rows,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: { id: string; name: string }[];
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || null} onValueChange={(next) => onChange(next ?? '')}>
        <SelectTrigger id={id} className="w-48">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          {rows.map((student) => (
            <SelectItem key={student.id} value={student.id}>
              {student.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
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
    <ToggleGroup
      variant="outline"
      value={[consent ?? 'unset']}
      onValueChange={(values) => {
        const next = values[0];
        if (next === 'yes' || next === 'no') onChange(next);
        else if (next === 'unset') onChange(null);
      }}
    >
      <ToggleGroupItem value="yes" className={pressed}>
        yes
      </ToggleGroupItem>
      <ToggleGroupItem value="no" className={pressed}>
        no
      </ToggleGroupItem>
      <ToggleGroupItem value="unset" className={pressed}>
        unset
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
