export type DirLike = {
  isSameEntry: (other: DirLike) => Promise<boolean>;
  resolve?: (possibleDescendant: DirLike) => Promise<string[] | null>;
};

export async function assertOutputOutsideSource(source: DirLike, output: DirLike) {
  if (await source.isSameEntry(output)) {
    throw new Error('The output folder is the source folder. Originals are never modified.');
  }
  const outputInsideSource = await source.resolve?.(output);
  if (outputInsideSource && outputInsideSource.length > 0) {
    throw new Error('The output folder is inside the source folder. Choose a folder outside it.');
  }
  const sourceInsideOutput = await output.resolve?.(source);
  if (sourceInsideOutput && sourceInsideOutput.length > 0) {
    throw new Error(
      'The source folder is inside the output folder. Choose a different output folder.',
    );
  }
}
