import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { placeFaces } from '../db/mutate';

const OWN = 'own';

export function WrongStudent({
  projectId,
  faceIds,
  wrongStudentId,
  students,
  disabled,
  onDone,
}: {
  projectId: string;
  faceIds: string[];
  wrongStudentId: string | null;
  students: { id: string; name: string }[];
  disabled?: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(OWN);
  const others = students.filter((student) => student.id !== wrongStudentId);
  const count = faceIds.length;
  const items = [
    { value: OWN, label: 'Their own group' },
    ...others.map((student) => ({ value: student.id, label: student.name })),
  ];

  async function apply() {
    await placeFaces(projectId, faceIds, {
      wrongStudentId,
      moveToStudentId: target === OWN ? null : target,
    });
    setOpen(false);
    setTarget(OWN);
    onDone?.();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTarget(OWN);
      }}
    >
      <DialogTrigger
        render={<Button type="button" variant="outline" disabled={disabled || count === 0} />}
      >
        Wrong student
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wrong student</DialogTitle>
          <DialogDescription>
            {count === 1
              ? 'This face is the wrong student.'
              : `These ${count} faces are the wrong student.`}{' '}
            Leave them as their own group, or move them to someone already named.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="wrong-student-target">Another group</Label>
          <Select
            items={items}
            value={target}
            onValueChange={(value) => {
              if (value) setTarget(value);
            }}
          >
            <SelectTrigger id="wrong-student-target" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => void apply()}>
            {target === OWN ? 'Leave as their own group' : 'Move to that group'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
              setTarget(OWN);
            }}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
