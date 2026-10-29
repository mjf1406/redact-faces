const listeners = new Set<(message: string) => void>();

export function onDeviceLost(listener: (message: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportDeviceLost(message: string) {
  for (const listener of listeners) listener(message);
}
