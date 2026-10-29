const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif']);

function extension(name: string) {
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index + 1).toLowerCase() : '';
}

export async function collectImages(root: FileSystemDirectoryHandle) {
  const files: { relPath: string; handle: FileSystemFileHandle }[] = [];
  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    for await (const [name, handle] of dir.entries()) {
      const relPath = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === 'directory') await walk(handle, relPath);
      else if (IMAGE_EXT.has(extension(name))) files.push({ relPath, handle: handle });
    }
  }
  await walk(root, '');
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return files;
}

export async function readPermission(handle: FileSystemDirectoryHandle) {
  const options = { mode: 'read' as const };
  if ((await handle.queryPermission(options)) === 'granted') return true;
  return (await handle.requestPermission(options)) === 'granted';
}

export async function fileByRelPath(root: FileSystemDirectoryHandle, relPath: string) {
  const parts = relPath.split('/').filter(Boolean);
  let dir = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    dir = await dir.getDirectoryHandle(parts[i]);
  }
  const handle = await dir.getFileHandle(parts[parts.length - 1]);
  return handle.getFile();
}

export async function writeBlob(root: FileSystemDirectoryHandle, relPath: string, blob: Blob) {
  const parts = relPath.split('/').filter(Boolean);
  let dir = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    dir = await dir.getDirectoryHandle(parts[i], { create: true });
  }
  const handle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function fileExists(root: FileSystemDirectoryHandle, relPath: string) {
  try {
    const parts = relPath.split('/').filter(Boolean);
    let dir = root;
    for (let i = 0; i < parts.length - 1; i += 1) dir = await dir.getDirectoryHandle(parts[i]);
    await dir.getFileHandle(parts[parts.length - 1]);
    return true;
  } catch {
    return false;
  }
}
