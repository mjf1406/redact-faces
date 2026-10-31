import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { db } from '../db/db';
import { confirmSuggestion, markFaces } from '../db/mutate';
import { Crop } from './crop';
import { WrongStudent } from './WrongStudent';

export function GuessStep({ projectId }: { projectId: string }) {
  const faces =
    useLiveQuery(() => db.faces.where('projectId').equals(projectId).toArray(), [projectId]) ?? [];
  const students =
    useLiveQuery(
      () => db.students.where('projectId').equals(projectId).sortBy('name'),
      [projectId],
    ) ?? [];
  const [cursor, setCursor] = useState(0);
  const suggested = faces.filter((face) => face.state === 'suggested');
  const index = Math.min(cursor, Math.max(0, suggested.length - 1));
  const face = suggested[index];

  if (!face) {
    return (
      <p className="text-sm text-muted-foreground">
        No guesses to check. Continue to set who can be shown.
      </p>
    );
  }

  const studentName =
    students.find((student) => student.id === face.suggestedStudentId)?.name ?? 'Unknown';

  return (
    <Card>
      <CardContent className="grid gap-4">
        <p className="text-sm">
          Guess {index + 1} of {suggested.length}
        </p>
        <p className="text-sm">Is this {studentName}?</p>
        <div>
          {face.crop ? (
            <div className="size-28 overflow-hidden rounded-lg border">
              <Crop blob={face.crop} alt="" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No crop</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void confirmSuggestion(projectId, face.id)}>
            Yes, this is {studentName}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={index <= 0}
            onClick={() => setCursor(index - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={index >= suggested.length - 1}
            onClick={() => setCursor(index + 1)}
          >
            Skip
          </Button>
        </div>
        <WrongStudent
          key={face.id}
          projectId={projectId}
          faceIds={[face.id]}
          wrongStudentId={face.suggestedStudentId}
          students={students}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void markFaces(projectId, [face.id], 'safe')}
          >
            OK to show
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void markFaces(projectId, [face.id], 'falsePositive')}
          >
            Not a face
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
