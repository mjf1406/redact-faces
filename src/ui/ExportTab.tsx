import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SliderField } from '@/components/slider-field';
import { db } from '../db/db';
import { updateSettings } from '../db/projects';
import type { ExportSummary } from '../export/runExport';
import { runExport } from '../export/runExport';
import { zipDownloadName } from '../export/zip';
import { canExport, canOverrideExport, exportBlockers } from '../engine/exportGate';
import { computeRedactionRects } from '../engine/redact';
import { RESPONSIBILITY } from '../gate/copy';
import { useUi } from './store';

const MAX_SIDES = [
  { value: 'original', label: 'Original' },
  { value: '3840', label: '3840' },
  { value: '2560', label: '2560' },
  { value: '1920', label: '1920' },
] as const;

export function ExportTab({ projectId }: { projectId: string }) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const photos =
    useLiveQuery(() => db.photos.where('projectId').equals(projectId).toArray(), [projectId]) ?? [];
  const faces =
    useLiveQuery(() => db.faces.where('projectId').equals(projectId).toArray(), [projectId]) ?? [];
  const students =
    useLiveQuery(() => db.students.where('projectId').equals(projectId).toArray(), [projectId]) ??
    [];
  const navigate = useNavigate();
  const setReviewIndex = useUi((state) => state.setReviewIndex);
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const [alsoUnresolved, setAlsoUnresolved] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
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
  const projectName = project.name;

  async function start(redactUnresolved: boolean, override = false) {
    setError(null);
    setOverrideOpen(false);
    cancelRef.current = false;
    try {
      const result = await runExport(
        projectId,
        { redactUnresolved, override },
        (done, total, current) => setProgress(`${done} / ${total} ${current}`),
        () => cancelRef.current,
      );
      if (result.zip) downloadBlob(result.zip, zipDownloadName(projectName));
      setSummary(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed.');
    } finally {
      setProgress(null);
    }
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
  const dimension = String(project.settings.maxExportDimension ?? 'original');

  return (
    <section className="grid gap-4">
      <p className="text-sm text-muted-foreground">{RESPONSIBILITY}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
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
      <SliderField
        label="Redaction padding"
        min={0}
        max={0.8}
        value={project.settings.redactionPadding}
        onChange={(redactionPadding) => void updateSettings(projectId, { redactionPadding })}
      />
      {sample?.photo.thumb ? (
        <Sample photo={sample.photo} rects={sample.rects} />
      ) : (
        <p className="text-sm text-muted-foreground">Scan a photo to preview padding.</p>
      )}
      <SliderField
        label="JPEG quality"
        min={0.6}
        max={0.95}
        value={project.settings.jpegQuality}
        onChange={(jpegQuality) => void updateSettings(projectId, { jpegQuality })}
      />
      <div className="grid gap-2">
        <Label htmlFor="max-side">Max long side</Label>
        <Select
          items={MAX_SIDES}
          value={dimension}
          onValueChange={(value) => {
            if (value !== 'original' && value !== '3840' && value !== '2560' && value !== '1920') {
              return;
            }
            void updateSettings(projectId, {
              maxExportDimension:
                value === 'original' ? null : (Number(value) as 3840 | 2560 | 1920),
            });
          }}
        >
          <SelectTrigger id="max-side" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MAX_SIDES.map((side) => (
              <SelectItem key={side.value} value={side.value}>
                {side.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <h2 className="font-heading text-base font-medium">Review redacted photos</h2>
      <ul className="grid list-none gap-2 p-0">
        {redactedPhotos.map((photo) => (
          <li key={photo.id}>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const ordered = [...photos].sort((a, b) => a.relPath.localeCompare(b.relPath));
                setReviewIndex(
                  Math.max(
                    0,
                    ordered.findIndex((item) => item.id === photo.id),
                  ),
                );
                void navigate({
                  to: '/p/$projectId/$step',
                  params: { projectId, step: 'review' },
                });
              }}
            >
              {photo.relPath}
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={!ready} onClick={() => void start(false)}>
          Download zip
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!override}
          onClick={() => {
            setAlsoUnresolved(false);
            setOverrideOpen(true);
          }}
        >
          Download anyway…
        </Button>
        {progress ? (
          <Button type="button" variant="outline" onClick={() => (cancelRef.current = true)}>
            Cancel export
          </Button>
        ) : null}
      </div>
      {progress ? <p className="text-sm text-muted-foreground">{progress}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {summary ? (
        <div className="grid gap-2 text-sm">
          <p>
            {summary.cancelled
              ? 'Cancelled. Nothing was downloaded.'
              : `Downloaded ${summary.exported}. Faces redacted ${summary.facesRedacted}.`}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {summary.skipped.map((item) => (
              <li key={item.relPath}>
                Skipped {item.relPath}: {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unresolved faces will stay visible</DialogTitle>
            <DialogDescription>
              {blockers.unresolvedFaceIds.length} faces are unresolved. They will not be blacked out
              unless you tick the box.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Checkbox
              id="also-unresolved"
              checked={alsoUnresolved}
              onCheckedChange={(checked) => setAlsoUnresolved(checked === true)}
            />
            <Label htmlFor="also-unresolved">Also black out unresolved faces</Label>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => void start(alsoUnresolved, true)}>
              Download
            </Button>
            <Button type="button" variant="outline" onClick={() => setOverrideOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
    <div className="relative inline-block max-w-[280px]">
      <img src={url} alt="Padding preview" className="block h-auto w-full" />
      {rects.map((rect, index) => (
        <div
          key={index}
          className="pointer-events-none absolute bg-black"
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
