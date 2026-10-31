import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { addStudent, mergeStudents, setConsent } from '../db/mutate';
import { parseRoster } from '../lib/roster';

const pressed =
  'aria-pressed:bg-primary aria-pressed:text-primary-foreground hover:aria-pressed:bg-primary/80';

export function PermissionStep({ projectId }: { projectId: string }) {
  const students = useLiveQuery(
    () => db.students.where('projectId').equals(projectId).sortBy('name'),
    [projectId],
  );
  const [name, setName] = useState('');
  const [roster, setRoster] = useState('');
  const [mergeA, setMergeA] = useState('');
  const [mergeB, setMergeB] = useState('');
  const rows = students ?? [];

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Name a group first. Then choose who can be shown.
      </p>
    );
  }

  return (
    <section className="grid gap-4">
      <div className="grid gap-3">
        {rows.map((student) => (
          <div key={student.id} className="flex flex-wrap items-center gap-2">
            <strong className="text-sm">{student.name}</strong>
            {student.consent == null ? <Badge variant="outline">Will be blacked out</Badge> : null}
            <ToggleGroup
              variant="outline"
              spacing={2}
              value={student.consent ? [student.consent] : []}
              onValueChange={(values) => {
                const next = values[0];
                if (next === 'yes' || next === 'no') void setConsent(student.id, next);
              }}
            >
              <ToggleGroupItem value="yes" className={pressed}>
                Yes, show
              </ToggleGroupItem>
              <ToggleGroupItem value="no" className={pressed}>
                No, black out
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void addStudent(projectId, name).then(() => setName(''));
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="missing-name">Add a name that was missing</Label>
          <Input id="missing-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <Button type="submit">Add</Button>
      </form>
      <Collapsible>
        <CollapsibleTrigger render={<Button type="button" variant="outline" />}>
          Add a list of names
        </CollapsibleTrigger>
        <CollapsibleContent className="grid gap-3 pt-3">
          <div className="grid gap-2">
            <Label htmlFor="roster">
              One name per line. Optional <code>, yes</code> or <code>, no</code>.
            </Label>
            <Textarea
              id="roster"
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
        </CollapsibleContent>
      </Collapsible>
      <Collapsible>
        <CollapsibleTrigger render={<Button type="button" variant="outline" />}>
          Two names are the same person
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void mergeStudents(projectId, mergeA, mergeB);
            }}
          >
            <StudentPick
              id="merge-keep"
              label="Keep"
              value={mergeA}
              onChange={setMergeA}
              rows={rows}
            />
            <StudentPick
              id="merge-into"
              label="Merge into them"
              value={mergeB}
              onChange={setMergeB}
              rows={rows}
            />
            <Button type="submit" disabled={!mergeA || !mergeB}>
              Merge
            </Button>
          </form>
        </CollapsibleContent>
      </Collapsible>
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
