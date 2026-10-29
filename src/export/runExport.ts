import { db } from '../db/db';
import { jpegRelPath, exportScale } from '../engine/geometry';
import { assertOutputOutsideSource, type DirLike } from '../engine/folderGuard';
import { computeRedactionRects, isFaceResolved, scaleRects } from '../engine/redact';
import { canExport, canOverrideExport } from '../engine/exportGate';
import { fileExists, writeBlob } from '../lib/files';

export type ExportSummary = {
  exported: number;
  facesRedacted: number;
  skipped: { relPath: string; reason: string }[];
  cancelled: boolean;
};

function csvCell(value: string | number) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export async function runExport(
  projectId: string,
  output: FileSystemDirectoryHandle,
  opts: { redactUnresolved: boolean },
  onProgress: (done: number, total: number, current: string) => void,
  shouldCancel: () => boolean,
): Promise<ExportSummary> {
  const project = await db.projects.get(projectId);
  if (!project?.dirHandle) throw new Error('Reconnect the source folder before exporting.');
  await assertOutputOutsideSource(asDir(project.dirHandle), asDir(output));
  const [photos, faces, students] = await Promise.all([
    db.photos.where('projectId').equals(projectId).toArray(),
    db.faces.where('projectId').equals(projectId).toArray(),
    db.students.where('projectId').equals(projectId).toArray(),
  ]);
  const allowed = opts.redactUnresolved
    ? canOverrideExport({ photos, faces, students }) || canExport({ photos, faces, students })
    : canExport({ photos, faces, students });
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
  let exported = 0;
  let facesRedacted = 0;
  for (let index = 0; index < todo.length; index += 1) {
    if (shouldCancel()) {
      return { exported, facesRedacted, skipped, cancelled: true };
    }
    const photo = todo[index];
    onProgress(index, todo.length, photo.relPath);
    const photoFaces = faces.filter((face) => face.photoId === photo.id);
    const rects = computeRedactionRects(photo, photoFaces, students, project.settings, opts);
    const unresolved = photoFaces.filter((face) => !isFaceResolved(face, studentIds)).length;
    let rel = jpegRelPath(photo.relPath, used);
    while (await fileExists(output, rel)) rel = jpegRelPath(photo.relPath, used);
    const file = await fileFromProject(project.dirHandle, photo.relPath);
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
      await writeBlob(output, rel, blob);
    } finally {
      bitmap.close();
    }
    exported += 1;
    facesRedacted += rects.length;
    log.push([csvCell(rel), rects.length, unresolved].join(','));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await writeBlob(
    output,
    'redaction-log.csv',
    new Blob([log.join('\n') + '\n'], { type: 'text/csv' }),
  );
  onProgress(todo.length, todo.length, '');
  return { exported, facesRedacted, skipped, cancelled: false };
}

function asDir(handle: FileSystemDirectoryHandle): DirLike {
  return {
    isSameEntry: (other) => handle.isSameEntry(other as unknown as FileSystemHandle),
    resolve: handle.resolve
      ? (other) => handle.resolve?.(other as unknown as FileSystemHandle) ?? Promise.resolve(null)
      : undefined,
  };
}

async function fileFromProject(root: FileSystemDirectoryHandle, relPath: string) {
  const parts = relPath.split('/').filter(Boolean);
  let dir = root;
  for (let i = 0; i < parts.length - 1; i += 1) dir = await dir.getDirectoryHandle(parts[i]);
  return (await dir.getFileHandle(parts[parts.length - 1])).getFile();
}
