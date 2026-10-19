import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateStreak,
  earnedBadges,
  fullWeeks,
  weekProgress,
  countPractisedDays,
  getTrailDayStatus,
  hasEvening,
  hasMorning,
  isPractised,
  isQuietStudent,
  upsertCheckinInMemory,
  type PracticeMark,
} from '../practiceUtils';

vi.mock('../supabase', () => ({ supabase: { from: vi.fn() }, isDemoMode: () => false }));
import { supabase } from '../supabase';
import { recordCheckin } from '../checkinService';

const day = (d: number, morning = false, evening = false): PracticeMark => ({ day_number: d, morning, evening });

describe('Morning and Evening ticks', () => {
  it('counts a day when at least one is ticked', () => {
    expect(isPractised(day(1, true))).toBe(true);
    expect(isPractised(day(1, false, true))).toBe(true);
    expect(isPractised(day(1))).toBe(false);
    expect(isPractised(null)).toBe(false);
  });

  it('reads rows from before the ticks: done = morning', () => {
    expect(hasMorning({ day_number: 1, status: 'done' })).toBe(true);
    expect(hasEvening({ day_number: 1, status: 'done' })).toBe(false);
    expect(isPractised({ day_number: 1, status: 'rest' })).toBe(false);
  });
});

describe('trail', () => {
  it('shows both, one, today, missed and future', () => {
    expect(getTrailDayStatus(3, 5, day(3, true, true))).toBe('full');
    expect(getTrailDayStatus(3, 5, day(3, false, true))).toBe('evening');
    expect(getTrailDayStatus(3, 5, day(3, true, false))).toBe('morning');
    expect(getTrailDayStatus(5, 5, undefined)).toBe('today');
    expect(getTrailDayStatus(3, 5, day(3))).toBe('missed');
    expect(getTrailDayStatus(6, 5, undefined)).toBe('future');
  });

  it('counts practised days up to today', () => {
    expect(countPractisedDays([day(1, true), day(2), day(3, false, true), day(9, true)], 5)).toBe(2);
  });
});

describe('streak (the practice flame)', () => {
  it('is 0 without check-ins', () => {
    expect(calculateStreak([], 5)).toBe(0);
  });

  it('counts consecutive practised days ending today', () => {
    expect(calculateStreak([day(1, true), day(2, false, true), day(3, true, true)], 3)).toBe(3);
  });

  it('keeps yesterday\'s streak while today has no tick yet', () => {
    expect(calculateStreak([day(1, true), day(2, true)], 3)).toBe(2);
    expect(calculateStreak([day(1, true), day(2, true), day(3)], 3)).toBe(2);
  });

  it('starts again after a passed day without a tick', () => {
    expect(calculateStreak([day(1, true), day(3, true), day(4, true)], 4)).toBe(2);
    expect(calculateStreak([day(1, true), day(2), day(3, true)], 3)).toBe(1);
  });

  it('a past day filled in later repairs the streak', () => {
    const before = [day(1, true), day(3, true)];
    expect(calculateStreak(before, 3)).toBe(1);
    expect(calculateStreak([...before, day(2, false, true)], 3)).toBe(3);
  });

  it('stops at the last day of a finished practice', () => {
    expect(calculateStreak([day(39, true), day(40, true)], 45, 40)).toBe(2);
  });
});

describe('quiet students', () => {
  it('flags 4 days in a row without a tick', () => {
    // Days 2 to 5 without a tick, on the morning of day 6: quiet
    expect(isQuietStudent([day(1, true)], 6)).toBe(true);
    // On the morning of day 5 only days 2 to 4 are over: not quiet yet (same rule as the streak)
    expect(isQuietStudent([day(1, true)], 5)).toBe(false);
    expect(isQuietStudent([day(1, true), day(3, true)], 6)).toBe(false);
    expect(isQuietStudent([day(1, true), day(2), day(3), day(4), day(5)], 6)).toBe(true);
    // Ticked today: never quiet
    expect(isQuietStudent([day(6, true)], 6)).toBe(false);
    expect(isQuietStudent([], 3)).toBe(false);
  });
});

describe('in-memory upsert', () => {
  it('keeps one row per day', () => {
    const list = [{ id: 'a', day_number: 1, morning: true, evening: false, created_at: 'x' }];
    const next = upsertCheckinInMemory(list, { id: 'tmp', day_number: 1, morning: true, evening: true, created_at: 'y' });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 'a', evening: true, created_at: 'x' });
    expect(upsertCheckinInMemory(list, { id: 'b', day_number: 2, morning: true, evening: false, created_at: 'z' })).toHaveLength(2);
  });
});

describe('recordCheckin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves only the tapped tick, so a tick from another device is kept', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'c1', day_number: 5, morning: true, evening: false, status: 'done' },
      error: null,
    });
    const upsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ upsert });

    const res = await recordCheckin('org-1', 'batch-1', 'student-1', 5, 'morning', true);
    expect(res.success).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      { org_id: 'org-1', batch_id: 'batch-1', student_id: 'student-1', day_number: 5, morning: true },
      { onConflict: 'student_id,batch_id,day_number' }
    );
    const sent = upsert.mock.calls[0][0];
    expect('evening' in sent).toBe(false);
    expect('status' in sent).toBe(false);
  });

  it('reports a refused save', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'new row violates row-level security policy' } });
    const upsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ upsert });

    const res = await recordCheckin('org-1', 'batch-1', 'student-1', 9, 'evening', true);
    expect(res.success).toBe(false);
    expect(res.error).toBe('You do not have permission to do that.');
  });
});

describe('weekly badges (Phase 21)', () => {
  const tick = (day: number, morning = true, evening = false) => ({ day_number: day, morning, evening });
  const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => tick(from + i));

  it('earns a week when all 7 days have a tick, morning or evening', () => {
    expect(earnedBadges(days(1, 7), 40)).toEqual(['week1']);
    expect(earnedBadges([...days(1, 6), tick(7, false, true)], 40)).toEqual(['week1']);
    expect(earnedBadges(days(1, 6), 40)).toEqual([]);
    expect(earnedBadges([...days(1, 3), ...days(5, 14)], 40)).toEqual(['week2']);
  });

  it('a 40-day practice has 5 weekly badges and one for all 40 days', () => {
    expect(fullWeeks(40)).toBe(5);
    expect(earnedBadges(days(1, 40), 40)).toEqual(['week1', 'week2', 'week3', 'week4', 'week5', 'complete']);
    expect(earnedBadges(days(1, 39), 40)).not.toContain('complete');
  });

  it('knows where today sits in its week', () => {
    // Day 10 = week 2 (days 8-14); days 8 and 9 ticked, today not yet
    expect(weekProgress(days(8, 9), 10, 40)).toEqual({ week: 2, firstDay: 8, lastDay: 14, done: 2, openDays: 3, unbroken: true, earnsBadge: true });
    // Day 9 missed: the week is broken
    expect(weekProgress([tick(8), tick(10)], 10, 40)?.unbroken).toBe(false);
    // Days 36-40 are the last, shorter week: no weekly badge
    expect(weekProgress(days(36, 37), 38, 40)).toMatchObject({ week: 6, lastDay: 40, earnsBadge: false });
    expect(weekProgress([], 0, 40)).toBeNull();
  });
});
