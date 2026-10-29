import { INPUT_SIZE, THUMB_LONG_SIDE } from './constants';
import type { Tile } from './geometry';
import { ARCFACE_TEMPLATE } from './constants';
import { toCanvasTransform, umeyama } from './umeyama';

function canvas2d(width: number, height: number) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser cannot draw on a canvas.');
  return { canvas, ctx };
}

export function detectionInput(bitmap: ImageBitmap, tile: Tile) {
  const { ctx } = canvas2d(INPUT_SIZE, INPUT_SIZE);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  const scale = Math.min(INPUT_SIZE / tile.sw, INPUT_SIZE / tile.sh);
  ctx.drawImage(bitmap, tile.sx, tile.sy, tile.sw, tile.sh, 0, 0, tile.sw * scale, tile.sh * scale);
  const image = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const plane = INPUT_SIZE * INPUT_SIZE;
  const data = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    const pixel = i * 4;
    data[i] = (image.data[pixel] - 127.5) / 128;
    data[plane + i] = (image.data[pixel + 1] - 127.5) / 128;
    data[2 * plane + i] = (image.data[pixel + 2] - 127.5) / 128;
  }
  return { data, scale };
}

export async function jpegScaled(bitmap: ImageBitmap, longSide: number, quality: number) {
  const scale = Math.min(1, longSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const { canvas, ctx } = canvas2d(width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  if (!blob) throw new Error('Could not encode a JPEG.');
  return blob;
}

export async function photoThumb(bitmap: ImageBitmap) {
  return jpegScaled(bitmap, THUMB_LONG_SIDE, 0.8);
}

export async function alignFace(bitmap: ImageBitmap, kps: { x: number; y: number }[]) {
  const dst = ARCFACE_TEMPLATE.map(([x, y]) => ({ x, y }));
  const transform = toCanvasTransform(umeyama(kps, dst));
  const { canvas, ctx } = canvas2d(112, 112);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
  ctx.drawImage(bitmap, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  if (!blob) throw new Error('Could not encode a face crop.');
  const image = ctx.getImageData(0, 0, 112, 112);
  const plane = 112 * 112;
  const data = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    const pixel = i * 4;
    data[i] = (image.data[pixel] - 127.5) / 127.5;
    data[plane + i] = (image.data[pixel + 1] - 127.5) / 127.5;
    data[2 * plane + i] = (image.data[pixel + 2] - 127.5) / 127.5;
  }
  return { blob, data };
}
