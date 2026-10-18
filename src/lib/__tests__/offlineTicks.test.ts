import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../checkinService', () => ({ recordCheckin: vi.fn() }));
import { recordCheckin } from '../checkinService';
import { flushTicks, pendingTicks, queueTick } from '../offlineTicks';

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => (store[k] = v),
    removeItem: (k: string) => delete store[k],
  });
  vi.mocked(recordCheckin).mockReset();
});

const tick = (day: number, slot: 'morning' | 'evening', value = true) => ({ orgId: 'o', batchId: 'b', studentId: 's', day, slot, value });

describe('offline ticks', () => {
  it('keeps the latest value per day and tick', () => {
    queueTick(tick(3, 'morning', true));
    queueTick(tick(3, 'morning', false));
    queueTick(tick(3, 'evening', true));
    expect(pendingTicks('b', 's')).toEqual([tick(3, 'morning', false), tick(3, 'evening', true)]);
  });

  it('sends waiting ticks when back online and stops while still offline', async () => {
    queueTick(tick(1, 'morning'));
    queueTick(tick(2, 'morning'));
    vi.mocked(recordCheckin).mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false, offline: true });
    expect(await flushTicks()).toBe(1);
    expect(pendingTicks()).toEqual([tick(2, 'morning')]);
    vi.mocked(recordCheckin).mockResolvedValueOnce({ success: true });
    expect(await flushTicks()).toBe(1);
    expect(pendingTicks()).toEqual([]);
  });

  it('drops a tick the server refuses (e.g. a day that is not open)', async () => {
    queueTick(tick(9, 'evening'));
    vi.mocked(recordCheckin).mockResolvedValueOnce({ success: false, error: 'You do not have permission to do that.' });
    expect(await flushTicks()).toBe(0);
    expect(pendingTicks()).toEqual([]);
  });
});
