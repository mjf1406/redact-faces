import { Zip, ZipPassThrough } from 'fflate';

export function zipDownloadName(projectName: string) {
  const cleaned = projectName.replace(/[\\/:*?"<>|]+/g, ' ').trim();
  return `${cleaned || 'photos'}.zip`;
}

export function createZipArchive() {
  const parts: BlobPart[] = [];
  let error: Error | null = null;
  const zip = new Zip((err, data) => {
    if (err) error = err;
    else if (data.byteLength) parts.push(data.slice());
  });
  return {
    add(name: string, data: Uint8Array) {
      const entry = new ZipPassThrough(name);
      zip.add(entry);
      entry.push(data, true);
      if (error) throw error;
    },
    finish() {
      zip.end();
      if (error) throw error;
      return new Blob(parts, { type: 'application/zip' });
    },
    discard() {
      zip.terminate();
    },
  };
}
