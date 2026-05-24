export async function processInChunks<T, R>(
  items: T[],
  chunkSize: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const results = await Promise.allSettled(chunk.map(worker));
    for (const r of results) {
      if (r.status === 'fulfilled') out.push(r.value);
    }
  }
  return out;
}
