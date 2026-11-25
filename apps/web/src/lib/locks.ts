// One-at-a-time queues keyed by name (single server process). Scene changes
// and room-metadata pushes of a program run in order, so a slow or older
// update can never land after a newer one.
const g = globalThis as unknown as { __locks?: Map<string, Promise<unknown>> };
const locks = (g.__locks ??= new Map());

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  locks.set(key, tail);
  // Forget the queue once it's idle.
  tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return run;
}
