/**
 * Run async mapper over items with at most `limit` concurrent executions.
 * Results preserve input order.
 */
export async function mapLimit(items, limit, mapper) {
  if (!items.length) return [];
  const results = new Array(items.length);
  let next = 0;
  const workers = Math.min(Math.max(1, limit), items.length);

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await mapper(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}
