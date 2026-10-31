export type GroupableFace = {
  id: string;
  state: string;
  bundleId?: string | null;
};

export function partitionUnassigned(
  faces: readonly GroupableFace[],
  eligibleIds: ReadonlySet<string>,
) {
  const bundles = new Map<string, string[]>();
  const free: string[] = [];
  const leftover: string[] = [];
  for (const face of faces) {
    if (face.state !== 'unassigned') continue;
    if (face.bundleId) {
      const list = bundles.get(face.bundleId) ?? [];
      list.push(face.id);
      bundles.set(face.bundleId, list);
      continue;
    }
    if (eligibleIds.has(face.id)) free.push(face.id);
    else leftover.push(face.id);
  }
  return { bundles: [...bundles.values()], free, leftover };
}
