import { cp, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const LIMIT = 24 * 1024 * 1024;
const srcDir = path.resolve('node_modules/onnxruntime-web/dist');
const destDir = path.resolve('public/ort');

await mkdir(destDir, { recursive: true });

let names;
try {
  names = await readdir(srcDir);
} catch {
  console.error('onnxruntime-web is not installed. Run bun install first.');
  process.exit(1);
}

const copied = [];
const skipped = [];
for (const name of names) {
  if (!name.includes('asyncify')) continue;
  if (!/\.(wasm|mjs)$/.test(name)) continue;
  const from = path.join(srcDir, name);
  const info = await stat(from);
  if (!info.isFile()) continue;
  if (info.size > LIMIT) {
    skipped.push({ name, bytes: info.size });
    console.warn(`Skipping ${name} (${info.size} bytes) — over 24 MiB. Host it on R2.`);
    continue;
  }
  await cp(from, path.join(destDir, name));
  copied.push({ name, bytes: info.size });
}

await writeFile(
  path.join(destDir, 'manifest.json'),
  JSON.stringify({ copied, skipped, limitBytes: LIMIT }, null, 2),
);

console.log(`Copied ${copied.length} ORT runtime file(s) to public/ort.`);
if (skipped.length > 0) {
  console.log(
    'Production loads skipped files from ${VITE_LARGE_MODEL_BASE_URL}/ort/. Upload them to that prefix.',
  );
}
