import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
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
    <section>
      <label>
        Detection mode
        <select
          value={settings.detectionMode}
          onChange={(event) =>
            void updateSettings(projectId, { detectionMode: event.target.value as DetectionMode })
          }
        >
          <option value="fast">Fast</option>
          <option value="thorough">Thorough</option>
          <option value="maximum">Maximum</option>
        </select>
      </label>
      <Slider
        label="Suggest threshold (untuned)"
        min={SUGGEST_THRESHOLD_MIN}
        max={SUGGEST_THRESHOLD_MAX}
        value={settings.suggestThreshold}
        onChange={(suggestThreshold) => void updateSettings(projectId, { suggestThreshold })}
      />
      <Slider
        label="Suggest margin (untuned)"
        min={0}
        max={0.3}
        value={settings.suggestMargin}
        onChange={(suggestMargin) => void updateSettings(projectId, { suggestMargin })}
      />
      <Slider
        label="Cluster threshold (untuned)"
        min={SUGGEST_THRESHOLD_MIN}
        max={SUGGEST_THRESHOLD_MAX}
        value={settings.clusterThreshold}
        onChange={(clusterThreshold) => void updateSettings(projectId, { clusterThreshold })}
      />
      <p>{storage}</p>
      <div className="row">
        <button type="button" onClick={downloadBackup}>
          Download backup
        </button>
        <button
          type="button"
          onClick={() =>
            void clearModelCache()
              .then(() => restartEngine())
              .then(() =>
                setMessage('Model cache cleared. The next scan downloads the models again.'),
              )
          }
        >
          Clear model cache
        </button>
        {accuratePackEnabled() || saved.modelPack === 'accurate' ? (
          <button
            type="button"
            onClick={() =>
              void reembedProject(projectId, saved.modelPack === 'fast' ? 'accurate' : 'fast').then(
                () => setMessage('Embeddings were recomputed.'),
              )
            }
          >
            Switch model pack and recompute embeddings
          </button>
        ) : null}
      </div>
      <p>
        The backup contains student names and consent. Treat the file as sensitive data. It does not
        contain embeddings.
      </p>
      {message ? <p>{message}</p> : null}
      <h2>Matching calibration</h2>
      {calibration ? (
        <div className="histograms">
          <Hist title="Same student" counts={calibration.sameBins} />
          <Hist title="Different students" counts={calibration.differentBins} />
        </div>
      ) : (
        <p>Label at least two students with three confirmed faces each to compare similarities.</p>
      )}
    </section>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label} {value.toFixed(2)}
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Hist({ title, counts }: { title: string; counts: number[] }) {
  const peak = Math.max(1, ...counts);
  return (
    <div>
      <h3>{title}</h3>
      <div className="hist">
        {counts.map((count, index) => (
          <div
            key={index}
            style={{ height: `${(count / peak) * 100}%` }}
            title={`${index / 10}–${(index + 1) / 10}: ${count}`}
          />
        ))}
      </div>
    </div>
  );
}
