import { db } from '../db/db';
import { jpegRelPath, exportScale } from '../engine/geometry';
import { computeRedactionRects, isFaceResolved, scaleRects } from '../engine/redact';
import { allowExport } from '../engine/exportGate';
import { fileByRelPath } from '../lib/files';
import { createZipArchive } from './zip';

export type ExportSummary = {
  exported: number;
  facesRedacted: number;
  skipped: { relPath: string; reason: string }[];
  cancelled: boolean;
  zip: Blob | null;
};

function csvCell(value: string | number) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export async function runExport(
  projectId: string,
  opts: { redactUnresolved: boolean; override?: boolean },
  onProgress: (done: number, total: number, current: string) => void,
  shouldCancel: () => boolean,
): Promise<ExportSummary> {
  const project = await db.projects.get(projectId);
  if (!project?.dirHandle) throw new Error('Reconnect the source folder before exporting.');
  const [photos, faces, students] = await Promise.all([
    db.photos.where('projectId').equals(projectId).toArray(),
    db.faces.where('projectId').equals(projectId).toArray(),
    db.students.where('projectId').equals(projectId).toArray(),
  ]);
  const allowed = allowExport({ photos, faces, students }, { override: opts.override === true });
  if (!allowed)
    throw new Error('Export is blocked until the scan is finished and every face is resolved.');
  const studentIds = new Set(students.map((student) => student.id));
  const skipped = photos
    .filter((photo) => photo.status !== 'done')
    .map((photo) => ({
      relPath: photo.relPath,
      reason: photo.error || photo.status,
    }));
  const todo = photos.filter((photo) => photo.status === 'done');
  const used = new Set<string>();
  const log: string[] = ['filename,redactedFaceCount,unresolvedFaceCount'];
  const archive = createZipArchive();
  let exported = 0;
  let facesRedacted = 0;
  try {
    for (let index = 0; index < todo.length; index += 1) {
      if (shouldCancel()) {
        archive.discard();
        return { exported, facesRedacted, skipped, cancelled: true, zip: null };
      }
      const photo = todo[index];
      onProgress(index, todo.length, photo.relPath);
      const photoFaces = faces.filter((face) => face.photoId === photo.id);
      const rects = computeRedactionRects(photo, photoFaces, students, project.settings, opts);
      const unresolved = photoFaces.filter((face) => !isFaceResolved(face, studentIds)).length;
      const rel = jpegRelPath(photo.relPath, used);
      const file = await fileByRelPath(project.dirHandle, photo.relPath);
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      try {
        const scale = exportScale(bitmap.width, bitmap.height, project.settings.maxExportDimension);
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not draw the export image.');
        ctx.drawImage(bitmap, 0, 0, width, height);
        ctx.fillStyle = '#000000';
        for (const rect of scaleRects(rects, scale)) ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        const blob = await canvas.convertToBlob({
          type: 'image/jpeg',
          quality: project.settings.jpegQuality,
        });
        if (!blob) throw new Error('Could not encode the JPEG.');
        archive.add(rel, new Uint8Array(await blob.arrayBuffer()));
      } finally {
        bitmap.close();
      }
      exported += 1;
      facesRedacted += rects.length;
      log.push([csvCell(rel), rects.length, unresolved].join(','));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    archive.add('redaction-log.csv', new TextEncoder().encode(`${log.join('\n')}\n`));
    onProgress(todo.length, todo.length, '');
    return { exported, facesRedacted, skipped, cancelled: false, zip: archive.finish() };
  } catch (error) {
    archive.discard();
    throw error;
  }
}
