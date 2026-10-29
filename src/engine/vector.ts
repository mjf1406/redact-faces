export function dot(a: ArrayLike<number>, b: ArrayLike<number>) {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) sum += a[i] * b[i];
  return sum;
}

export function l2normalize(values: ArrayLike<number>) {
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) sum += values[i] * values[i];
  const norm = Math.sqrt(sum) || 1;
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i += 1) out[i] = values[i] / norm;
  return out;
}

export function meanNormalize(rows: ArrayLike<number>[]) {
  const out = new Float32Array(rows[0].length);
  for (const row of rows) {
    for (let i = 0; i < out.length; i += 1) out[i] += row[i];
  }
  for (let i = 0; i < out.length; i += 1) out[i] /= rows.length;
  return l2normalize(out);
}

export function packRows(rows: ArrayLike<number>[], dim: number) {
  const matrix = new Float32Array(rows.length * dim);
  for (let r = 0; r < rows.length; r += 1) {
    matrix.set(rows[r].length === dim ? rows[r] : Float32Array.from(rows[r]), r * dim);
  }
  return matrix;
}
