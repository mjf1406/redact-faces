const releasers = new Map<string, () => void>();

export function holdProjectLock(projectId: string) {
  if (!navigator.locks?.request) return Promise.resolve('acquired' as const);
  const name = `redact-faces-${projectId}`;
  return new Promise<'acquired' | 'busy'>((resolve) => {
    void navigator.locks.request(name, { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve('busy');
        return undefined;
      }
      resolve('acquired');
      return new Promise<void>((release) => {
        releasers.set(projectId, release);
      });
    });
  });
}

export function releaseProjectLock(projectId: string) {
  const release = releasers.get(projectId);
  if (!release) return;
  releasers.delete(projectId);
  release();
}
