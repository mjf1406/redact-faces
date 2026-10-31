type LockResult = 'acquired' | 'busy';

type Entry = {
  count: number;
  release: (() => void) | null;
  result: Promise<LockResult>;
};

const entries = new Map<string, Entry>();

function finish(projectId: string, entry: Entry, result: LockResult) {
  if (entries.get(projectId) === entry) entries.delete(projectId);
  return result;
}

export function holdProjectLock(projectId: string): Promise<LockResult> {
  const existing = entries.get(projectId);
  if (existing) {
    existing.count += 1;
    return existing.result;
  }

  if (!navigator.locks?.request) {
    const entry: Entry = {
      count: 1,
      release: () => {
        entries.delete(projectId);
      },
      result: Promise.resolve('acquired'),
    };
    entries.set(projectId, entry);
    return entry.result;
  }

  let resolveResult: (result: LockResult) => void = () => {};
  const result = new Promise<LockResult>((resolve) => {
    resolveResult = resolve;
  });
  const entry: Entry = { count: 1, release: null, result };
  entries.set(projectId, entry);

  void navigator.locks.request(`redact-faces-${projectId}`, { ifAvailable: true }, (lock) => {
    if (!lock) {
      resolveResult(finish(projectId, entry, 'busy'));
      return undefined;
    }
    if (entry.count <= 0) {
      resolveResult(finish(projectId, entry, 'acquired'));
      return undefined;
    }
    resolveResult('acquired');
    return new Promise<void>((unlock) => {
      entry.release = () => {
        if (entries.get(projectId) === entry) entries.delete(projectId);
        unlock();
      };
      if (entry.count <= 0) entry.release();
    });
  });

  return result;
}

export function releaseProjectLock(projectId: string) {
  const entry = entries.get(projectId);
  if (!entry) return;
  entry.count -= 1;
  if (entry.count > 0) return;
  entry.release?.();
}

export async function waitForProjectLock(projectId: string, waitMs = 400): Promise<LockResult> {
  const started = Date.now();
  for (;;) {
    const result = await holdProjectLock(projectId);
    if (result === 'acquired' || Date.now() - started >= waitMs) return result;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
