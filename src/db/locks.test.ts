// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { holdProjectLock, releaseProjectLock, waitForProjectLock } from './locks';

function installLocks() {
  const held = new Set<string>();

  function request(
    name: string,
    optionsOrCallback: LockOptions | ((lock: Lock | null) => unknown),
    maybeCallback?: (lock: Lock | null) => unknown,
  ) {
    const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    if (!callback) throw new Error('Missing lock callback.');
    return new Promise<unknown>((resolve, reject) => {
      queueMicrotask(() => {
        if (options.ifAvailable && held.has(name)) {
          void Promise.resolve(callback(null)).then(resolve, (error: unknown) => {
            reject(error instanceof Error ? error : new Error('Lock request failed.'));
          });
          return;
        }
        held.add(name);
        void Promise.resolve(callback({ name } as Lock)).then(
          (value) => {
            held.delete(name);
            resolve(value);
          },
          (error: unknown) => {
            held.delete(name);
            reject(error instanceof Error ? error : new Error('Lock request failed.'));
          },
        );
      });
    });
  }

  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request } as LockManager,
  });
}

function probe(projectId: string) {
  return navigator.locks.request(`redact-faces-${projectId}`, { ifAvailable: true }, (lock) =>
    lock ? 'free' : 'busy',
  );
}

describe('project locks', () => {
  afterEach(() => {
    releaseProjectLock('p');
    releaseProjectLock('p');
    releaseProjectLock('other');
    releaseProjectLock('other');
  });

  it('shares one lock across repeated holds in this tab', async () => {
    installLocks();
    const first = holdProjectLock('p');
    const second = holdProjectLock('p');
    await expect(first).resolves.toBe('acquired');
    await expect(second).resolves.toBe('acquired');
    await expect(probe('p')).resolves.toBe('busy');
    releaseProjectLock('p');
    await expect(probe('p')).resolves.toBe('busy');
    releaseProjectLock('p');
    await expect(probe('p')).resolves.toBe('free');
  });

  it('keeps the lock when a hold is released before the browser grants it', async () => {
    installLocks();
    const first = holdProjectLock('p');
    releaseProjectLock('p');
    const second = holdProjectLock('p');
    await expect(first).resolves.toBe('acquired');
    await expect(second).resolves.toBe('acquired');
    await expect(probe('p')).resolves.toBe('busy');
    releaseProjectLock('p');
    await expect(probe('p')).resolves.toBe('free');
  });

  it('reports busy when another tab holds the project', async () => {
    installLocks();
    let unlock: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const external = navigator.locks.request('redact-faces-other', () => gate);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(holdProjectLock('other')).resolves.toBe('busy');
    unlock();
    await external;
    await expect(holdProjectLock('other')).resolves.toBe('acquired');
    releaseProjectLock('other');
  });

  it('waits for a lock that a closing page still holds', async () => {
    installLocks();
    let unlock: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const external = navigator.locks.request('redact-faces-p', () => gate);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const pending = waitForProjectLock('p', 400);
    setTimeout(unlock, 80);
    await expect(pending).resolves.toBe('acquired');
    await external;
    releaseProjectLock('p');
  });
});
