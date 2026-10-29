export function histogram(values: readonly number[], bins: number, min: number, max: number) {
  const counts = new Array<number>(bins).fill(0);
  const span = max - min || 1;
  for (const value of values) {
    let index = Math.floor(((value - min) / span) * bins);
    if (index < 0) index = 0;
    if (index >= bins) index = bins - 1;
    counts[index] += 1;
  }
  return counts;
}

export function median(values: readonly number[]) {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}
