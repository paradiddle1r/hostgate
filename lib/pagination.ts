/** Fetch every ordered page; reject failures rather than return partial inventory.
 * Callers must use a deterministic order (including a unique tie-breaker) and
 * repeat their property/tenant filters on each request. Offset pagination does
 * not provide a database snapshot across concurrent writes.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: unknown;
  }>,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("Page size must be a positive integer");
  }
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    if (!data) throw new Error("Missing page data");
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
