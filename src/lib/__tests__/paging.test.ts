import { describe, it, expect, vi } from 'vitest';
import { fetchAllPages, PAGE_SIZE } from '../paging';

describe('fetchAllPages', () => {
  it('keeps asking until a page comes back short, so nothing past 1,000 rows is lost', async () => {
    const total = 2725;
    const page = vi.fn(async (from: number, to: number) => ({
      data: Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i),
      error: null,
    }));
    const rows = await fetchAllPages<number>(page);
    expect(rows).toHaveLength(total);
    expect(rows[rows.length - 1]).toBe(total - 1);
    expect(page).toHaveBeenCalledTimes(3);
    expect(page).toHaveBeenNthCalledWith(2, PAGE_SIZE, 2 * PAGE_SIZE - 1);
  });

  it('stops after one call for a short list and reports errors', async () => {
    const ok = vi.fn(async () => ({ data: [1, 2, 3], error: null }));
    expect(await fetchAllPages<number>(ok)).toEqual([1, 2, 3]);
    expect(ok).toHaveBeenCalledTimes(1);
    await expect(fetchAllPages(async () => ({ data: null, error: { message: 'boom' } }))).rejects.toThrow('boom');
  });
});
