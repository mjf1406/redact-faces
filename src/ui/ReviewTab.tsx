import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type PointerEvent } from 'react';
import { db } from '../db/db';
import { addManualRegion, addStudent, assignFaces, markFaces } from '../db/mutate';
import { computeRedactionRects, isFaceResolved, shouldRedactFace } from '../engine/redact';
import { fileByRelPath } from '../lib/files';
import type { FaceRecord, PhotoRecord, StudentRecord } from '../domain';
import { useUi } from './store';
import { VirtualRows } from './virtual';

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
        target instanceof HTMLSelectElement
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
    <section className="review">
      <div className="row">
        {(['all', 'unresolved', 'redactions', 'errors'] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
          >
            {item === 'all'
              ? 'All'
              : item === 'unresolved'
                ? 'Has unresolved'
                : item === 'redactions'
                  ? 'Has redactions'
                  : 'Errors'}
          </button>
        ))}
        <label>
          <input
            type="checkbox"
            checked={preview}
            onChange={(event) => setPreview(event.target.checked)}
          />{' '}
          Preview redactions
        </label>
        <label>
          <input
            type="checkbox"
            checked={draw}
            onChange={(event) => setDraw(event.target.checked)}
          />{' '}
          Draw region
        </label>
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
        <p>No photo in this filter.</p>
      )}
      <FaceEditor
        projectId={projectId}
        face={faces.find((face) => face.id === selectedId) ?? null}
        students={students}
      />
      <div className="filmstrip">
        <VirtualRows items={filtered} rowHeight={72} height={160}>
          {(item, itemIndex) => (
            <button
              type="button"
              className={itemIndex === safeIndex ? 'selected' : ''}
              onClick={() => setIndex(itemIndex)}
            >
              {item.relPath}
            </button>
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
      className="stage"
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
      {url ? <img src={url} alt={photo.relPath} /> : <p>Loading photo…</p>}
      {drag && current ? (
        <div
          className="box unresolved"
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
          className="blackout"
          style={{
            left: `${(rect.x / photo.width) * 100}%`,
            top: `${(rect.y / photo.height) * 100}%`,
            width: `${(rect.w / photo.width) * 100}%`,
            height: `${(rect.h / photo.height) * 100}%`,
          }}
        />
      ))}
      {faces.map((face) => (
        <button
          type="button"
          key={face.id}
          className={`box ${boxClass(face, students, preview)}`}
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
  if (preview && shouldRedactFace(face, students, { redactUnresolved: false })) return 'redacted';
  if (face.state === 'safe') return 'safe';
  if (shouldRedactFace(face, students, { redactUnresolved: false })) return 'redacted';
  const ids = new Set(students.map((student) => student.id));
  if (!isFaceResolved(face, ids)) return 'unresolved';
  return 'visible';
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
  if (!face) return <p>Select a face to assign it.</p>;
  return (
    <form
      className="row"
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
      <label>
        Assign selected face
        <input
          list="student-names"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button type="submit">Assign</button>
      <button type="button" onClick={() => void markFaces(projectId, [face.id], 'safe')}>
        OK to show
      </button>
      <button type="button" onClick={() => void markFaces(projectId, [face.id], 'falsePositive')}>
        Not a face
      </button>
    </form>
  );
}
