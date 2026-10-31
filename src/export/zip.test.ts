import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createZipArchive, zipDownloadName } from './zip';

describe('export zip', () => {
  it('stores the photos and the log without recompressing them', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const csv = new TextEncoder().encode('filename,redactedFaceCount\na.jpg,1,0\n');
    const archive = createZipArchive();
    archive.add('trip/a.jpg', jpeg);
    archive.add('redaction-log.csv', csv);
    const blob = archive.finish();
    const extracted = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(extracted['trip/a.jpg']).toEqual(jpeg);
    expect(extracted['redaction-log.csv']).toEqual(csv);
  });

  it('names the download after the project', () => {
    expect(zipDownloadName('Class 2026')).toBe('Class 2026.zip');
    expect(zipDownloadName('a/b:c')).toBe('a b c.zip');
    expect(zipDownloadName('   ')).toBe('photos.zip');
  });
});
