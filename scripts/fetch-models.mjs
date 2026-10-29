import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Unzip, UnzipInflate } from 'fflate';
import { parseOnnxIo } from './onnx-io.mjs';

const PACKS = [
  {
    pack: 'fast',
    zipName: 'buffalo_sc.zip',
    destDir: path.resolve('public/models'),
    files: ['det_500m.onnx', 'w600k_mbf.onnx'],
  },
  {
    pack: 'accurate',
    zipName: 'buffalo_l.zip',
    destDir: path.resolve('models-large'),
    files: ['det_10g.onnx', 'w600k_r50.onnx'],
  },
];

const DIRECT = {
  'buffalo_sc.zip':
    'https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_sc.zip',
  'buffalo_l.zip':
    'https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip',
};

async function resolveUrl(zipName) {
  const direct = DIRECT[zipName];
  const head = await fetch(direct, { method: 'HEAD' });
  if (head.ok) return direct;
  console.log(`HEAD ${direct} returned ${head.status}. Looking up the v0.7 release assets.`);
  const release = await fetch(
    'https://api.github.com/repos/deepinsight/insightface/releases/tags/v0.7',
    { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'redact-faces' } },
  );
  if (!release.ok) {
    throw new Error(`Could not read InsightFace releases (${release.status}).`);
  }
  const body = await release.json();
  const asset = (body.assets ?? []).find((item) => item.name === zipName);
  if (!asset?.browser_download_url) {
    throw new Error(`Release v0.7 has no asset named ${zipName}.`);
  }
  return asset.browser_download_url;
}

function concat(chunks) {
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function downloadZip(url, wanted) {
  const response = await fetch(url, { headers: { 'User-Agent': 'redact-faces' } });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed ${response.status} ${url}`);
  }
  const found = new Map();
  const unzipper = new Unzip();
  unzipper.register(UnzipInflate);
  unzipper.onfile = (file) => {
    const base = file.name.split('/').pop() ?? file.name;
    if (!wanted.has(base)) {
      file.ondata = () => {};
      file.start();
      return;
    }
    const chunks = [];
    file.ondata = (error, data, final) => {
      if (error) throw error;
      if (data?.length) chunks.push(data);
      if (final) found.set(base, concat(chunks));
    };
    file.start();
  };
  const reader = response.body.getReader();
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    unzipper.push(step.value, false);
  }
  unzipper.push(new Uint8Array(), true);
  return found;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const models = [];
const ioNotes = ['# Model inputs and outputs', ''];
let failed = false;

for (const pack of PACKS) {
  await mkdir(pack.destDir, { recursive: true });
  let files;
  try {
    const url = await resolveUrl(pack.zipName);
    console.log(`Downloading ${pack.zipName} from ${url}`);
    files = await downloadZip(url, new Set(pack.files));
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to fetch ${pack.zipName}: ${message}`);
    for (const filename of pack.files) {
      models.push({
        id: filename.replace(/\.onnx$/, ''),
        filename,
        bytes: 0,
        sha256: '',
        pack: pack.pack,
        available: false,
      });
    }
    ioNotes.push(`## ${pack.zipName}`, '', `Download failed: ${message}`, '');
    continue;
  }

  for (const filename of pack.files) {
    const bytes = files.get(filename);
    const id = filename.replace(/\.onnx$/, '');
    if (!bytes) {
      failed = true;
      console.error(`${pack.zipName} did not contain ${filename}`);
      models.push({ id, filename, bytes: 0, sha256: '', pack: pack.pack, available: false });
      continue;
    }
    await writeFile(path.join(pack.destDir, filename), bytes);
    const hash = sha256(bytes);
    models.push({
      id,
      filename,
      bytes: bytes.length,
      sha256: hash,
      pack: pack.pack,
      available: true,
    });
    const io = parseOnnxIo(bytes);
    ioNotes.push(
      `## ${filename}`,
      '',
      `- Pack: ${pack.pack}`,
      `- Bytes: ${bytes.length}`,
      `- SHA-256: ${hash}`,
      '',
    );
    ioNotes.push('### Inputs', '');
    for (const input of io.inputs) {
      ioNotes.push(
        `- \`${input.name}\` elem ${input.elemType ?? '?'} shape [${input.shape.join(', ')}]`,
      );
    }
    ioNotes.push('', '### Outputs', '');
    for (const output of io.outputs) {
      ioNotes.push(
        `- \`${output.name}\` elem ${output.elemType ?? '?'} shape [${output.shape.join(', ')}]`,
      );
    }
    ioNotes.push('');
    console.log(`Wrote ${filename} (${bytes.length} bytes)`);
  }
}

const manifest = { models };
await mkdir(path.resolve('src/engine'), { recursive: true });
await writeFile(
  path.resolve('src/engine/models.manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
await mkdir(path.resolve('docs'), { recursive: true });
await writeFile(path.resolve('docs/model-io.md'), ioNotes.join('\n'));
console.log('Wrote src/engine/models.manifest.json and docs/model-io.md');

if (failed) {
  console.error('One or more model files could not be downloaded.');
  console.error('Re-run: bun run models:fetch');
  process.exit(1);
}
