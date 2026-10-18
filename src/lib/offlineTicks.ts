import { recordCheckin } from './checkinService';

/**
 * Ticks made without a connection are kept on this phone and sent when the
 * connection is back (the save is idempotent: one row per student and day).
 */
const KEY = 'sadhana_pending_ticks';

export interface PendingTick {
  orgId: string;
  batchId: string;
  studentId: string;
  day: number;
  slot: 'morning' | 'evening';
  value: boolean;
}

function read(): PendingTick[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function write(list: PendingTick[]) {
  try {
    if (list.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage blocked: nothing to keep
  }
}

/** Keeps the latest value per day and tick. */
export function queueTick(t: PendingTick): void {
  const list = read().filter((p) => !(p.batchId === t.batchId && p.studentId === t.studentId && p.day === t.day && p.slot === t.slot));
  write([...list, t]);
}

export function pendingTicks(batchId?: string, studentId?: string): PendingTick[] {
  return read().filter((p) => (!batchId || p.batchId === batchId) && (!studentId || p.studentId === studentId));
}

let flushing = false;

/** Sends what is waiting. Returns how many were saved. A tick the server refuses is dropped. */
export async function flushTicks(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let saved = 0;
  try {
    for (const t of read()) {
      const res = await recordCheckin(t.orgId, t.batchId, t.studentId, t.day, t.slot, t.value);
      if (res.success) saved += 1;
      if (res.success || !res.offline) {
        write(read().filter((p) => !(p.batchId === t.batchId && p.studentId === t.studentId && p.day === t.day && p.slot === t.slot)));
      } else {
        break; // still offline
      }
    }
  } finally {
    flushing = false;
  }
  return saved;
}
