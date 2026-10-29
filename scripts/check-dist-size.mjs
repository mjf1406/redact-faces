import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const LIMIT = 24 * 1024 * 1024;
const root = path.resolve('dist');

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      console.error('dist/ does not exist. Run the build first.');
      process.exit(1);
    }
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

const files = await walk(root);
const tooBig = [];
for (const file of files) {
  const info = await stat(file);
  if (info.size > LIMIT) tooBig.push({ file, size: info.size });
}

if (tooBig.length > 0) {
  console.error(`These files exceed 24 MiB (Cloudflare Pages rejects files over 25 MiB):`);
  for (const item of tooBig) {
    console.error(`  ${item.size}  ${path.relative(root, item.file)}`);
  }
  process.exit(1);
}

console.log(`check:dist-size ok (${files.length} files, each <= 24 MiB)`);
