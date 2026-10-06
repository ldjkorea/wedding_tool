/** Share only an unfinished read inside one mounted console/session; never cache a response. */
export function deduplicateRead<T>(reads: Map<string, Promise<T>>, key: string, work: () => Promise<T>): Promise<T> {
  const previous = reads.get(key);
  if (previous) return previous;
  const pending = work().finally(() => { if (reads.get(key) === pending) reads.delete(key); });
  reads.set(key, pending);
  return pending;
}
