import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const runtimeDir = path.resolve('node_modules/onnxruntime-web/dist');
const files = [
  {
    name: 'ort-wasm-simd-threaded.asyncify.wasm',
    contentType: 'application/wasm',
  },
  {
    name: 'ort-wasm-simd-threaded.asyncify.mjs',
    contentType: 'text/javascript',
  },
];

function envValue(name) {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  let text = '';
  try {
    text = readFileSync('.env', 'utf8');
  } catch {
    return '';
  }
  const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : '';
}

function wrangler(args) {
  const result = spawnSync(process.execPath, ['x', 'wrangler', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status !== 0) {
    throw new Error(output || `wrangler ${args.join(' ')} failed`);
  }
  return output;
}

function buckets() {
  const output = wrangler(['r2', 'bucket', 'list']);
  return [...output.matchAll(/name:\s+(\S+)/g)].map((match) => match[1]);
}

function bucketForPublicHost(host) {
  const named = process.argv[2];
  if (named) return named;
  const names = buckets();
  for (const name of names) {
    const info = wrangler(['r2', 'bucket', 'info', name, '--json']);
    if (info.includes(host)) return name;
  }
  throw new Error(
    `No R2 bucket advertises ${host}. Pass the bucket name: bun scripts/publish-ort.mjs <bucket>`,
  );
}

const modelBase = envValue('VITE_LARGE_MODEL_BASE_URL').replace(/\/$/, '');
if (!modelBase) {
  console.error('Set VITE_LARGE_MODEL_BASE_URL to the public R2 URL first.');
  process.exit(1);
}

const host = new URL(modelBase).host;
const bucket = bucketForPublicHost(host);
console.log(`Uploading the WebGPU runtime to ${bucket}/ort/`);

for (const file of files) {
  wrangler([
    'r2',
    'object',
    'put',
    `${bucket}/ort/${file.name}`,
    '--file',
    path.join(runtimeDir, file.name),
    '--content-type',
    file.contentType,
    '--remote',
    '-y',
  ]);
  console.log(`Uploaded ${file.name}`);
}

const corsPath = path.join(mkdtempSync(path.join(tmpdir(), 'ort-cors-')), 'cors.json');
writeFileSync(
  corsPath,
  JSON.stringify(
    [
      {
        AllowedOrigins: [
          'https://redact-faces-4gx.pages.dev',
          'http://localhost:5173',
          'http://localhost:4173',
        ],
        AllowedMethods: ['GET', 'HEAD'],
        AllowedHeaders: ['*'],
        MaxAgeSeconds: 86400,
      },
    ],
    null,
    2,
  ),
);

try {
  wrangler(['r2', 'bucket', 'cors', 'set', bucket, '--file', corsPath, '-y']);
} finally {
  rmSync(path.dirname(corsPath), { recursive: true, force: true });
}

console.log(`Runtime URL: ${modelBase}/ort/`);
