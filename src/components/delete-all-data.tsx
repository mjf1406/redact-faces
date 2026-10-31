import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteAllData } from '../db/projects';

export function DeleteAllData() {
  const [phrase, setPhrase] = useState('');

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) setPhrase('');
      }}
    >
      <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>
        Delete all data
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (phrase !== 'DELETE') return;
            void deleteAllData();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all data</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes projects, names, consent, and folder access on this browser. Model
              downloads stay cached.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="delete-phrase">Type DELETE</Label>
            <Input
              id="delete-phrase"
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" variant="destructive" disabled={phrase !== 'DELETE'}>
              Delete all data
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
