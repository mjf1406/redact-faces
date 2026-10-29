import { INPUT_SIZE, TILE_OVERLAP, type DetectionMode } from './constants';

export type Tile = { sx: number; sy: number; sw: number; sh: number };

export function letterbox(srcW: number, srcH: number, inputSize = INPUT_SIZE) {
  const scale = Math.min(inputSize / srcW, inputSize / srcH);
  return {
    scale,
    resizedW: srcW * scale,
    resizedH: srcH * scale,
    inputSize,
  };
}

export function mapInputToSource(
  x: number,
  y: number,
  scale: number,
  originX: number,
  originY: number,
) {
  return { x: originX + x / scale, y: originY + y / scale };
}

export function detectionTiles(width: number, height: number, mode: DetectionMode): Tile[] {
  const full: Tile = { sx: 0, sy: 0, sw: width, sh: height };
  if (mode === 'fast') return [full];
  const count = mode === 'thorough' ? 2 : 3;
  const tiles = [full];
  const denom = 1 + (count - 1) * (1 - TILE_OVERLAP);
  const tileW = width / denom;
  const tileH = height / denom;
  const stepX = tileW * (1 - TILE_OVERLAP);
  const stepY = tileH * (1 - TILE_OVERLAP);
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      let sx = col * stepX;
      let sy = row * stepY;
      if (sx + tileW > width) sx = Math.max(0, width - tileW);
      if (sy + tileH > height) sy = Math.max(0, height - tileH);
      tiles.push({
        sx,
        sy,
        sw: Math.min(tileW, width - sx),
        sh: Math.min(tileH, height - sy),
      });
    }
  }
  return tiles;
}

export function exportScale(width: number, height: number, maxDim: number | null): number {
  if (maxDim == null) return 1;
  const longSide = Math.max(width, height);
  if (longSide <= maxDim) return 1;
  return maxDim / longSide;
}

export function jpegRelPath(relPath: string, used: Set<string>): string {
  const slash = Math.max(relPath.lastIndexOf('/'), relPath.lastIndexOf('\\'));
  const dir = slash >= 0 ? relPath.slice(0, slash + 1).replaceAll('\\', '/') : '';
  const file = slash >= 0 ? relPath.slice(slash + 1) : relPath;
  const dot = file.lastIndexOf('.');
  const stem = dot > 0 ? file.slice(0, dot) : file;
  let name = `${dir}${stem}.jpg`;
  let n = 2;
  while (used.has(name)) {
    name = `${dir}${stem}-${n}.jpg`;
    n += 1;
  }
  used.add(name);
  return name;
}
