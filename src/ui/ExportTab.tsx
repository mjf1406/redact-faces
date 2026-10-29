import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from '../db/db';
import { updateSettings } from '../db/projects';
import type { ExportSummary } from '../export/runExport';
import { runExport } from '../export/runExport';
import { canExport, canOverrideExport, exportBlockers } from '../engine/exportGate';
import { computeRedactionRects } from '../engine/redact';
import { RESPONSIBILITY } from '../gate/copy';
import { useUi } from './store';

export function ExportTab({ projectId }: { projectId: string }) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const photos =
    useLiveQuery(() => db.photos.where('projectId').equals(projectId).toArray(), [projectId]) ?? [];
  const faces =
    useLiveQuery(() => db.faces.where('projectId').equals(projectId).toArray(), [projectId]) ?? [];
  const students =
    useLiveQuery(() => db.students.where('projectId').equals(projectId).toArray(), [projectId]) ??
    [];
  const setTab = useUi((state) => state.setTab);
  const setReviewIndex = useUi((state) => state.setReviewIndex);
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const [phrase, setPhrase] = useState('');
  const [alsoUnresolved, setAlsoUnresolved] = useState(false);
  const blockers = exportBlockers({ photos, faces, students });
  const unset = students.filter((student) => student.consent == null).length;
  const ready = canExport({ photos, faces, students });
  const override = canOverrideExport({ photos, faces, students });
  const samplePhoto = photos.find((item) =>
    faces.some((face) => face.photoId === item.id && item.thumb),
  );
  const sample =
    samplePhoto && project
      ? {
          photo: samplePhoto,
          rects: computeRedactionRects(
            samplePhoto,
            faces.filter((face) => face.photoId === samplePhoto.id),
            students,
            project.settings,
            { redactUnresolved: false },
          ),
        }
      : null;

  if (!project) return null;

  async function start(redactUnresolved: boolean) {
    const output = await window.showDirectoryPicker({ mode: 'readwrite' });
    cancelRef.current = false;
    const result = await runExport(
      projectId,
      output,
      { redactUnresolved },
      (done, total, current) => setProgress(`${done} / ${total} ${current}`),
      () => cancelRef.current,
    );
    setSummary(result);
    setProgress(null);
  }

  const redactedPhotos = photos.filter((photo) =>
    faces.some(
      (face) =>
        face.photoId === photo.id &&
        computeRedactionRects(photo, [face], students, project.settings, {
          redactUnresolved: false,
        }).length > 0,
    ),
  );

  return (
    <section>
      <p className="responsibility">{RESPONSIBILITY}</p>
      <ul>
        <li>
          {blockers.photosNotDone.length === 0
            ? 'Scan complete.'
            : `${blockers.photosNotDone.length} photos are not done.`}
        </li>
        <li>{blockers.unresolvedFaceIds.length} unresolved faces.</li>
        <li>{unset} students have unset consent. Unset is treated as no.</li>
        <li>
          {photos.filter((photo) => photo.status === 'unsupported').length} unsupported photos. They
          are never exported.
        </li>
      </ul>
      <label>
        Redaction padding {project.settings.redactionPadding.toFixed(2)}
        <input
          type="range"
          min={0}
          max={0.8}
          step={0.01}
          value={project.settings.redactionPadding}
          onChange={(event) =>
            void updateSettings(projectId, { redactionPadding: Number(event.target.value) })
          }
        />
      </label>
      {sample?.photo.thumb ? (
        <Sample photo={sample.photo} rects={sample.rects} />
      ) : (
        <p>Scan a photo to preview padding.</p>
      )}
      <label>
        JPEG quality {project.settings.jpegQuality.toFixed(2)}
        <input
          type="range"
          min={0.6}
          max={0.95}
          step={0.01}
          value={project.settings.jpegQuality}
          onChange={(event) =>
            void updateSettings(projectId, { jpegQuality: Number(event.target.value) })
          }
        />
      </label>
      <label>
        Max long side
        <select
          value={project.settings.maxExportDimension ?? 'original'}
          onChange={(event) => {
            const value = event.target.value;
            void updateSettings(projectId, {
              maxExportDimension:
                value === 'original' ? null : (Number(value) as 3840 | 2560 | 1920),
            });
          }}
        >
          <option value="original">Original</option>
          <option value="3840">3840</option>
          <option value="2560">2560</option>
          <option value="1920">1920</option>
        </select>
      </label>
      <h2>Review redacted photos</h2>
      <ul className="plain">
        {redactedPhotos.map((photo) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => {
                setTab('review');
                const ordered = [...photos].sort((a, b) => a.relPath.localeCompare(b.relPath));
                setReviewIndex(
                  Math.max(
                    0,
                    ordered.findIndex((item) => item.id === photo.id),
                  ),
                );
              }}
            >
              {photo.relPath}
            </button>
          </li>
        ))}
      </ul>
      <div className="row">
        <button type="button" disabled={!ready} onClick={() => void start(false)}>
          Export
        </button>
        <button
          type="button"
          disabled={!override}
          onClick={() => {
            setPhrase('');
            setAlsoUnresolved(false);
            document.querySelector<HTMLDialogElement>('#export-override')?.showModal();
          }}
        >
          Export anyway…
        </button>
        {progress ? (
          <button type="button" onClick={() => (cancelRef.current = true)}>
            Cancel export
          </button>
        ) : null}
      </div>
      {progress ? <p>{progress}</p> : null}
      {summary ? (
        <div>
          <p>
            Exported {summary.exported}. Faces redacted {summary.facesRedacted}.
            {summary.cancelled ? ' Cancelled.' : ''}
          </p>
          <ul>
            {summary.skipped.map((item) => (
              <li key={item.relPath}>
                Skipped {item.relPath}: {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <dialog id="export-override">
        <form
          method="dialog"
          onSubmit={(event) => {
            if (phrase !== 'EXPORT') {
              event.preventDefault();
              return;
            }
            void start(alsoUnresolved);
          }}
        >
          <h2>Unresolved faces will stay visible</h2>
          <p>
            {blockers.unresolvedFaceIds.length} faces are unresolved. They will not be blacked out
            unless you tick the box. Type EXPORT to continue.
          </p>
          <label>
            <input
              type="checkbox"
              checked={alsoUnresolved}
              onChange={(event) => setAlsoUnresolved(event.target.checked)}
            />{' '}
            Also black out unresolved faces
          </label>
          <label>
            Type EXPORT
            <input value={phrase} onChange={(event) => setPhrase(event.target.value)} />
          </label>
          <button type="submit" disabled={phrase !== 'EXPORT'}>
            Export
          </button>
          <button
            type="button"
            onClick={() => document.querySelector<HTMLDialogElement>('#export-override')?.close()}
          >
            Cancel
          </button>
        </form>
      </dialog>
    </section>
  );
}

function Sample({
  photo,
  rects,
}: {
  photo: { width: number; height: number; thumb: Blob | null };
  rects: { x: number; y: number; w: number; h: number }[];
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo.thumb) return;
    const next = URL.createObjectURL(photo.thumb);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [photo.thumb]);
  if (!url) return null;
  return (
    <div className="stage sample">
      <img src={url} alt="Padding preview" />
      {rects.map((rect, index) => (
        <div
          key={index}
          className="blackout"
          style={{
            left: `${(rect.x / photo.width) * 100}%`,
            top: `${(rect.y / photo.height) * 100}%`,
            width: `${(rect.w / photo.width) * 100}%`,
            height: `${(rect.h / photo.height) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
