/**
 * Supabase returns at most 1,000 rows per request. Lists that can grow past
 * that (a batch's check-ins, everyone in the organisation, all leads) are
 * fetched page by page, so nothing is silently cut off.
 */
export const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** `page(from, to)` must return the same query with `.range(from, to)` and a stable order. */
export async function fetchAllPages<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const from = i * PAGE_SIZE;
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return rows;
}
