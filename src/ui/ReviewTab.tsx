import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { db } from '../db/db';
import { addManualRegion, addStudent, assignFaces, markFaces } from '../db/mutate';
import { WrongStudent } from './WrongStudent';
import { computeRedactionRects, isFaceResolved, shouldRedactFace } from '../engine/redact';
import { fileByRelPath } from '../lib/files';
import type { FaceRecord, PhotoRecord, StudentRecord } from '../domain';
import { useUi } from './store';
import { VirtualRows } from './virtual';

const pressed =
  'aria-pressed:bg-primary aria-pressed:text-primary-foreground hover:aria-pressed:bg-primary/80';
const frame =
  'absolute min-h-0 min-w-0 rounded-none border-2 bg-transparent p-0 shadow-none hover:bg-transparent';

export function ReviewTab({ projectId }: { projectId: string }) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const photos =
    useLiveQuery(
      () => db.photos.where('projectId').equals(projectId).sortBy('relPath'),
      [projectId],
    ) ?? [];
  const faces =
    useLiveQuery(() => db.faces.where('projectId').equals(projectId).toArray(), [projectId]) ?? [];
  const students =
    useLiveQuery(
      () => db.students.where('projectId').equals(projectId).sortBy('name'),
      [projectId],
    ) ?? [];
  const filter = useUi((state) => state.reviewFilter);
  const setFilter = useUi((state) => state.setReviewFilter);
  const index = useUi((state) => state.reviewIndex);
  const setIndex = useUi((state) => state.setReviewIndex);
  const [preview, setPreview] = useState(false);
  const [draw, setDraw] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = photos.filter((photo) => photoMatches(photo, faces, students, filter));
  const safeIndex = Math.min(index, Math.max(0, filtered.length - 1));
  const photo = filtered[safeIndex];
  const photoFaces = faces.filter((face) => face.photoId === photo?.id);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement &&
          target.closest('[data-slot="select-trigger"],[role="menu"],[role="dialog"]'))
      ) {
        return;
      }
      if (event.key === 'ArrowRight') setIndex(Math.min(filtered.length - 1, safeIndex + 1));
      if (event.key === 'ArrowLeft') setIndex(Math.max(0, safeIndex - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered.length, safeIndex, setIndex]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          variant="outline"
          value={[filter]}
          onValueChange={(values) => {
            const next = values[0];
            if (
              next === 'all' ||
              next === 'unresolved' ||
              next === 'redactions' ||
              next === 'errors'
            ) {
              setFilter(next);
            }
          }}
        >
          <ToggleGroupItem value="all" className={pressed}>
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="unresolved" className={pressed}>
            Has unresolved
          </ToggleGroupItem>
          <ToggleGroupItem value="redactions" className={pressed}>
            Has redactions
          </ToggleGroupItem>
          <ToggleGroupItem value="errors" className={pressed}>
            Errors
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <Checkbox
            id="preview-redactions"
            checked={preview}
            onCheckedChange={(checked) => setPreview(checked)}
          />
          <Label htmlFor="preview-redactions">Preview redactions</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="draw-region"
            checked={draw}
            onCheckedChange={(checked) => setDraw(checked)}
          />
          <Label htmlFor="draw-region">Draw region</Label>
        </div>
      </div>
      {photo && project ? (
        <Viewer
          projectHandle={project.dirHandle}
          photo={photo}
          faces={photoFaces}
          students={students}
          padding={project.settings.redactionPadding}
          preview={preview}
          draw={draw}
          onPick={setSelectedId}
          onManual={(box) => void addManualRegion(projectId, photo.id, box)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No photo in this filter.</p>
      )}
      <FaceEditor
        projectId={projectId}
        face={faces.find((face) => face.id === selectedId) ?? null}
        students={students}
      />
      <div className="h-40">
        <VirtualRows items={filtered} rowHeight={72} height={160}>
          {(item, itemIndex) => (
            <Button
              type="button"
              variant={itemIndex === safeIndex ? 'default' : 'outline'}
              className="h-full w-[calc(100%-0.5rem)] justify-start"
              onClick={() => setIndex(itemIndex)}
            >
              {item.relPath}
            </Button>
          )}
        </VirtualRows>
      </div>
    </section>
  );
}

function photoMatches(
  photo: PhotoRecord,
  faces: FaceRecord[],
  students: StudentRecord[],
  filter: 'all' | 'unresolved' | 'redactions' | 'errors',
) {
  if (filter === 'all') return true;
  if (filter === 'errors') return photo.status === 'error' || photo.status === 'unsupported';
  const mine = faces.filter((face) => face.photoId === photo.id);
  const ids = new Set(students.map((student) => student.id));
  if (filter === 'unresolved') return mine.some((face) => !isFaceResolved(face, ids));
  return mine.some((face) => shouldRedactFace(face, students, { redactUnresolved: false }));
}

function Viewer({
  projectHandle,
  photo,
  faces,
  students,
  padding,
  preview,
  draw,
  onPick,
  onManual,
}: {
  projectHandle: FileSystemDirectoryHandle | null;
  photo: PhotoRecord;
  faces: FaceRecord[];
  students: StudentRecord[];
  padding: number;
  preview: boolean;
  draw: boolean;
  onPick: (id: string) => void;
  onManual: (box: { x: number; y: number; w: number; h: number }) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    async function load() {
      if (!projectHandle) return;
      const file = await fileByRelPath(projectHandle, photo.relPath);
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
      if (!blob || cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }
    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id, photo.relPath, projectHandle]);

  const rects = preview
    ? computeRedactionRects(
        photo,
        faces,
        students,
        { redactionPadding: padding },
        { redactUnresolved: false },
      )
    : [];

  function toPhoto(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * photo.width,
      y: ((event.clientY - bounds.top) / bounds.height) * photo.height,
    };
  }

  return (
    <div
      className="relative inline-block max-w-full"
      onPointerDown={(event) => {
        if (!draw) return;
        setDrag(toPhoto(event));
        setCurrent(toPhoto(event));
      }}
      onPointerMove={(event) => {
        if (drag) setCurrent(toPhoto(event));
      }}
      onPointerUp={(event) => {
        if (!drag || !draw) return;
        const end = toPhoto(event);
        const box = {
          x: Math.min(drag.x, end.x) / photo.width,
          y: Math.min(drag.y, end.y) / photo.height,
          w: Math.abs(end.x - drag.x) / photo.width,
          h: Math.abs(end.y - drag.y) / photo.height,
        };
        setDrag(null);
        if (box.w * photo.width > 8 && box.h * photo.height > 8) onManual(box);
      }}
    >
      {url ? (
        <img src={url} alt={photo.relPath} className="block h-auto max-h-[70vh] w-auto" />
      ) : (
        <p className="text-sm text-muted-foreground">Loading photo…</p>
      )}
      {drag && current ? (
        <div
          className={cn(frame, 'border-amber-500')}
          style={{
            left: `${(Math.min(drag.x, current.x) / (photo.width || 1)) * 100}%`,
            top: `${(Math.min(drag.y, current.y) / (photo.height || 1)) * 100}%`,
            width: `${(Math.abs(current.x - drag.x) / (photo.width || 1)) * 100}%`,
            height: `${(Math.abs(current.y - drag.y) / (photo.height || 1)) * 100}%`,
          }}
        />
      ) : null}
      {rects.map((rect, rectIndex) => (
        <div
          key={`redact-${rectIndex}`}
          className="pointer-events-none absolute bg-black"
          style={{
            left: `${(rect.x / photo.width) * 100}%`,
            top: `${(rect.y / photo.height) * 100}%`,
            width: `${(rect.w / photo.width) * 100}%`,
            height: `${(rect.h / photo.height) * 100}%`,
          }}
        />
      ))}
      {faces.map((face) => (
        <Button
          type="button"
          key={face.id}
          variant="outline"
          className={boxClass(face, students, preview)}
          style={{
            left: `${face.box.x * 100}%`,
            top: `${face.box.y * 100}%`,
            width: `${face.box.w * 100}%`,
            height: `${face.box.h * 100}%`,
          }}
          onClick={() => onPick(face.id)}
        />
      ))}
    </div>
  );
}

function boxClass(face: FaceRecord, students: StudentRecord[], preview: boolean) {
  if (preview && shouldRedactFace(face, students, { redactUnresolved: false })) {
    return cn(frame, 'border-red-500');
  }
  if (face.state === 'safe') return cn(frame, 'border-sky-500');
  if (shouldRedactFace(face, students, { redactUnresolved: false })) {
    return cn(frame, 'border-red-500');
  }
  const ids = new Set(students.map((student) => student.id));
  if (!isFaceResolved(face, ids)) return cn(frame, 'border-amber-500');
  return cn(frame, 'border-emerald-500');
}

function FaceEditor({
  projectId,
  face,
  students,
}: {
  projectId: string;
  face: FaceRecord | null;
  students: StudentRecord[];
}) {
  const [name, setName] = useState('');
  if (!face) return <p className="text-sm text-muted-foreground">Select a face to assign it.</p>;
  const wrongStudentId = face.studentId ?? face.suggestedStudentId;
  return (
    <div className="grid gap-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const existing = students.find(
            (student) => student.name.toLowerCase() === name.trim().toLowerCase(),
          );
          void (existing ? Promise.resolve(existing.id) : addStudent(projectId, name)).then((id) =>
            assignFaces(projectId, [face.id], id),
          );
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="assign-face">Assign selected face</Label>
          <Input
            id="assign-face"
            list="student-names"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button type="submit">Assign</Button>
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
      </form>
      {wrongStudentId ? (
        <WrongStudent
          key={face.id}
          projectId={projectId}
          faceIds={[face.id]}
          wrongStudentId={wrongStudentId}
          students={students}
        />
      ) : null}
    </div>
  );
}
