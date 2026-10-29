export type Point = { x: number; y: number };

export type Similarity = {
  scale: number;
  r00: number;
  r01: number;
  r10: number;
  r11: number;
  tx: number;
  ty: number;
};

function eigenVector(a00: number, a01: number, a11: number, lambda: number) {
  const a = a00 - lambda;
  const d = a11 - lambda;
  if (Math.abs(a01) > 1e-12) {
    const x = -d;
    const y = a01;
    const norm = Math.hypot(x, y) || 1;
    return { x: x / norm, y: y / norm };
  }
  if (Math.abs(a) <= Math.abs(d)) return { x: 1, y: 0 };
  return { x: 0, y: 1 };
}

function svd2(a: number, b: number, c: number, d: number) {
  const ata00 = a * a + c * c;
  const ata01 = a * b + c * d;
  const ata11 = b * b + d * d;
  const trace = ata00 + ata11;
  const det = ata00 * ata11 - ata01 * ata01;
  const root = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
  const l1 = trace / 2 + root;
  const l2 = Math.max(0, trace / 2 - root);
  const s0 = Math.sqrt(Math.max(0, l1));
  const s1 = Math.sqrt(Math.max(0, l2));
  const v0 = eigenVector(ata00, ata01, ata11, l1);
  const v1guess = eigenVector(ata00, ata01, ata11, l2);
  let v1x = -v0.y;
  let v1y = v0.x;
  if (v1x * v1guess.x + v1y * v1guess.y < 0) {
    v1x = -v1x;
    v1y = -v1y;
  }
  const apply = (vx: number, vy: number) => ({ x: a * vx + b * vy, y: c * vx + d * vy });
  let u0 = apply(v0.x, v0.y);
  let u1 = apply(v1x, v1y);
  if (s0 > 1e-12) u0 = { x: u0.x / s0, y: u0.y / s0 };
  else u0 = { x: 1, y: 0 };
  if (s1 > 1e-12) u1 = { x: u1.x / s1, y: u1.y / s1 };
  else u1 = { x: -u0.y, y: u0.x };
  const dot = u0.x * u1.x + u0.y * u1.y;
  u1 = { x: u1.x - dot * u0.x, y: u1.y - dot * u0.y };
  const norm = Math.hypot(u1.x, u1.y) || 1;
  u1 = { x: u1.x / norm, y: u1.y / norm };
  return {
    u00: u0.x,
    u10: u0.y,
    u01: u1.x,
    u11: u1.y,
    s0,
    s1,
    v00: v0.x,
    v10: v0.y,
    v01: v1x,
    v11: v1y,
  };
}

export function umeyama(src: readonly Point[], dst: readonly Point[]): Similarity {
  if (src.length !== dst.length || src.length < 2) {
    throw new Error('Umeyama needs two point sets of the same length');
  }
  const n = src.length;
  let sx = 0;
  let sy = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    sx += src[i].x;
    sy += src[i].y;
    dx += dst[i].x;
    dy += dst[i].y;
  }
  sx /= n;
  sy /= n;
  dx /= n;
  dy /= n;
  let variance = 0;
  let c00 = 0;
  let c01 = 0;
  let c10 = 0;
  let c11 = 0;
  for (let i = 0; i < n; i += 1) {
    const xs = src[i].x - sx;
    const ys = src[i].y - sy;
    const xd = dst[i].x - dx;
    const yd = dst[i].y - dy;
    variance += xs * xs + ys * ys;
    c00 += xd * xs;
    c01 += xd * ys;
    c10 += yd * xs;
    c11 += yd * ys;
  }
  variance /= n;
  c00 /= n;
  c01 /= n;
  c10 /= n;
  c11 /= n;
  if (variance < 1e-12) {
    return { scale: 1, r00: 1, r01: 0, r10: 0, r11: 1, tx: dx - sx, ty: dy - sy };
  }
  const svd = svd2(c00, c01, c10, c11);
  const detU = svd.u00 * svd.u11 - svd.u01 * svd.u10;
  const detV = svd.v00 * svd.v11 - svd.v01 * svd.v10;
  const d0 = 1;
  const d1 = detU * detV < 0 ? -1 : 1;
  const m00 = d0 * svd.v00;
  const m01 = d0 * svd.v10;
  const m10 = d1 * svd.v01;
  const m11 = d1 * svd.v11;
  const r00 = svd.u00 * m00 + svd.u01 * m10;
  const r01 = svd.u00 * m01 + svd.u01 * m11;
  const r10 = svd.u10 * m00 + svd.u11 * m10;
  const r11 = svd.u10 * m01 + svd.u11 * m11;
  const scale = (svd.s0 * d0 + svd.s1 * d1) / variance;
  return {
    scale,
    r00,
    r01,
    r10,
    r11,
    tx: dx - scale * (r00 * sx + r01 * sy),
    ty: dy - scale * (r10 * sx + r11 * sy),
  };
}

export function applySimilarity(sim: Similarity, point: Point): Point {
  return {
    x: sim.scale * (sim.r00 * point.x + sim.r01 * point.y) + sim.tx,
    y: sim.scale * (sim.r10 * point.x + sim.r11 * point.y) + sim.ty,
  };
}

export function toCanvasTransform(sim: Similarity) {
  return {
    a: sim.scale * sim.r00,
    b: sim.scale * sim.r10,
    c: sim.scale * sim.r01,
    d: sim.scale * sim.r11,
    e: sim.tx,
    f: sim.ty,
  };
}
