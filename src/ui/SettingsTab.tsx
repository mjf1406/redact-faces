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
            <SelectItem value="fast">Fast</SelectItem>
            <SelectItem value="thorough">Thorough</SelectItem>
            <SelectItem value="maximum">Maximum</SelectItem>
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
      <h2 className="font-heading text-base font-medium">Matching calibration</h2>
      {calibration ? (
        <div className="grid gap-4 sm:grid-cols-2">
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
    <div className="grid gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="flex h-32 items-end gap-0.5 border-b">
        {counts.map((count, index) => (
          <div
            key={index}
            className="min-h-0.5 flex-1 bg-primary"
            style={{ height: `${(count / peak) * 100}%` }}
            title={`${index / 10}–${(index + 1) / 10}: ${count}`}
          />
        ))}
      </div>
    </div>
  );
}
