import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { confirmedSimilarities } from '../engine/calibrate';
import {
  SUGGEST_THRESHOLD_MAX,
  SUGGEST_THRESHOLD_MIN,
  type DetectionMode,
} from '../engine/constants';
import { accuratePackEnabled } from '../engine/models';
import { clearModelCache } from '../engine/modelStore';
import { restartEngine } from '../engine/engineClient';
import { reembedProject } from '../scan/reembed';

const DETECTION_MODES = [
  { value: 'fast', label: 'Fast' },
  { value: 'thorough', label: 'Thorough' },
  { value: 'maximum', label: 'Maximum' },
] as const;

export function SettingsTab({ projectId }: { projectId: string }) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const students =
    useLiveQuery(() => db.students.where('projectId').equals(projectId).toArray(), [projectId]) ??
    [];
  const faces =
    useLiveQuery(() => db.faces.where('projectId').equals(projectId).toArray(), [projectId]) ?? [];
  const [storage, setStorage] = useState('Storage estimate unavailable.');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void navigator.storage?.estimate?.().then((estimate) => {
      const usage = estimate.usage ?? 0;
      const quota = estimate.quota ?? 0;
      setStorage(
        `Using ${(usage / 1024 / 1024).toFixed(1)} MiB of ${(quota / 1024 / 1024).toFixed(0)} MiB.`,
      );
    });
  }, []);

  if (!project) return null;
  const saved = project;
  const settings = saved.settings;
  const galleries = students.map((student) => ({
    id: student.id,
    embeddings: faces
      .filter(
        (face) => face.state === 'confirmed' && face.studentId === student.id && face.embedding,
      )
      .map((face) => face.embedding as Float32Array),
  }));
  const calibration = confirmedSimilarities(galleries);

  function downloadBackup() {
    const payload = {
      version: 1,
      project: { name: saved.name, modelPack: saved.modelPack, settings: saved.settings },
      students: students.map((student) => ({
        id: student.id,
        name: student.name,
        consent: student.consent,
      })),
    };
    void db.photos
      .where('projectId')
      .equals(projectId)
      .toArray()
      .then((photos) => {
        const file = {
          ...payload,
          photos: photos.map((photo) => ({
            relPath: photo.relPath,
            size: photo.size,
            lastModified: photo.lastModified,
            width: photo.width,
            height: photo.height,
            faces: faces
              .filter((face) => face.photoId === photo.id)
              .map((face) => ({
                box: face.box,
                kps: face.kps,
                score: face.score,
                lowConfidence: face.lowConfidence,
                source: face.source,
                state: face.state,
                studentId: face.studentId,
              })),
          })),
        };
        const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${saved.name}-backup.json`;
        link.click();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <section className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="detection-mode">Detection mode</Label>
        <Select
          items={DETECTION_MODES}
          value={settings.detectionMode}
          onValueChange={(value) => {
            if (value === 'fast' || value === 'thorough' || value === 'maximum') {
              void updateSettings(projectId, { detectionMode: value as DetectionMode });
            }
          }}
        >
          <SelectTrigger id="detection-mode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DETECTION_MODES.map((mode) => (
              <SelectItem key={mode.value} value={mode.value}>
                {mode.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SliderField
        label="Suggest threshold (untuned)"
        min={SUGGEST_THRESHOLD_MIN}
        max={SUGGEST_THRESHOLD_MAX}
        value={settings.suggestThreshold}
        onChange={(suggestThreshold) => void updateSettings(projectId, { suggestThreshold })}
      />
      <SliderField
        label="Suggest margin (untuned)"
        min={0}
        max={0.3}
        value={settings.suggestMargin}
        onChange={(suggestMargin) => void updateSettings(projectId, { suggestMargin })}
      />
      <SliderField
        label="Cluster threshold (untuned)"
        min={SUGGEST_THRESHOLD_MIN}
        max={SUGGEST_THRESHOLD_MAX}
        value={settings.clusterThreshold}
        onChange={(clusterThreshold) => void updateSettings(projectId, { clusterThreshold })}
      />
      <p className="text-sm text-muted-foreground">{storage}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={downloadBackup}>
          Download backup
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void clearModelCache()
              .then(() => restartEngine())
              .then(() =>
                setMessage('Model cache cleared. The next scan downloads the models again.'),
              )
          }
        >
          Clear model cache
        </Button>
        {accuratePackEnabled() || saved.modelPack === 'accurate' ? (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void reembedProject(projectId, saved.modelPack === 'fast' ? 'accurate' : 'fast').then(
                () => setMessage('Embeddings were recomputed.'),
              )
            }
          >
            Switch model pack and recompute embeddings
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        The backup contains student names and consent. Treat the file as sensitive data. It does not
        contain embeddings.
      </p>
      {message ? <p className="text-sm">{message}</p> : null}
      <div className="grid gap-2">
        <h2 className="font-heading text-base font-medium">Matching calibration</h2>
        <div className="grid gap-2 text-sm text-muted-foreground">
          <p>
            These charts count pairs of faces you have confirmed. Along the bottom, similarity runs
            from 0 to 1. Zero means the faces do not look alike. One means they look like the same
            face. Each bar is one tenth of that range. The numbers on the left are how many pairs
            landed in a bar. Each chart sizes its bars against its own tallest bar, so compare the
            numbers when you look from one chart to the other.
          </p>
          <p>
            Same student should gather near 1. Different students should gather near 0. Set the
            suggest threshold in the open space between those groups. Overlap means suggestions will
            mix people together.
          </p>
        </div>
      </div>
      {calibration ? (
        <div className="grid gap-6">
          <Hist title="Same student" counts={calibration.sameBins} />
          <Hist title="Different students" counts={calibration.differentBins} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Label at least two students with three confirmed faces each to compare similarities.
        </p>
      )}
    </section>
  );
}

function Hist({ title, counts }: { title: string; counts: number[] }) {
  const peak = Math.max(1, ...counts);
  return (
    <figure className="grid gap-1.5">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <p className="text-xs text-muted-foreground">Pairs</p>
      <div className="flex gap-2">
        <div className="flex h-32 w-8 shrink-0 flex-col justify-between text-right text-xs text-muted-foreground">
          <span>{peak}</span>
          <span>0</span>
        </div>
        <div
          className="flex h-32 min-w-0 flex-1 items-end gap-0.5 border-b border-l border-border pl-0.5"
          role="img"
          aria-label={histogramLabel(title, counts)}
        >
          {counts.map((count, index) => {
            const start = (index / 10).toFixed(1);
            const end = ((index + 1) / 10).toFixed(1);
            return (
              <div
                key={start}
                className={count > 0 ? 'min-h-0.5 flex-1 bg-primary' : 'flex-1'}
                style={{ height: `${(count / peak) * 100}%` }}
                title={`${start}–${end}: ${count} ${count === 1 ? 'pair' : 'pairs'}`}
              />
            );
          })}
        </div>
      </div>
      <div className="ml-10 grid gap-0.5 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>0</span>
          <span>0.5</span>
          <span>1</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Not alike</span>
          <span>Same face</span>
        </div>
        <p className="text-center">Similarity</p>
      </div>
    </figure>
  );
}

function histogramLabel(title: string, counts: number[]) {
  const bins = counts.map((count, index) => {
    const start = (index / 10).toFixed(1);
    const end = ((index + 1) / 10).toFixed(1);
    return `${start} to ${end}: ${count}`;
  });
  return `${title}. Pairs by similarity. ${bins.join(', ')}.`;
}
