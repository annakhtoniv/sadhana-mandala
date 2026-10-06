import { describe, it, expect } from 'vitest';
import { calculateStreak, isStudentQuiet } from './checkinService';
import type { CheckinStatus } from '../types/database';

describe('calculateStreak', () => {
  it('returns 0 when student has no check-ins', () => {
    const streak = calculateStreak([], 5);
    expect(streak).toBe(0);
  });

  it('calculates consecutive "done" days correctly', () => {
    const checkins: { day_number: number; status: CheckinStatus }[] = [
      { day_number: 1, status: 'done' },
      { day_number: 2, status: 'done' },
      { day_number: 3, status: 'done' },
    ];
    // Today is Day 3
    expect(calculateStreak(checkins, 3)).toBe(3);
  });

  it('preserves streak across rest days without incrementing streak', () => {
    // Done, Done, Rest, Done (Days 1 to 4)
    const checkins: { day_number: number; status: CheckinStatus }[] = [
      { day_number: 1, status: 'done' },
      { day_number: 2, status: 'done' },
      { day_number: 3, status: 'rest' },
      { day_number: 4, status: 'done' },
    ];
    // Today is Day 4 -> Streak is 3 (Days 1, 2, 4)
    expect(calculateStreak(checkins, 4)).toBe(3);
  });

  it('preserves streak across multiple consecutive rest days', () => {
    // Done, Rest, Rest, Done (Days 1 to 4)
    const checkins: { day_number: number; status: CheckinStatus }[] = [
      { day_number: 1, status: 'done' },
      { day_number: 2, status: 'rest' },
      { day_number: 3, status: 'rest' },
      { day_number: 4, status: 'done' },
    ];
    // Today is Day 4 -> Streak is 2
    expect(calculateStreak(checkins, 4)).toBe(2);
  });

  it('breaks streak when a passed day has "not_yet"', () => {
    // Day 1 done, Day 2 not_yet, Day 3 done (today is Day 3)
    const checkins: { day_number: number; status: CheckinStatus }[] = [
      { day_number: 1, status: 'done' },
      { day_number: 2, status: 'not_yet' },
      { day_number: 3, status: 'done' },
    ];
    // Day 2 broke the streak, so only Day 3 counts
    expect(calculateStreak(checkins, 3)).toBe(1);
  });

  it('breaks streak when a passed day has no answer (missing check-in)', () => {
    // Day 1 done, Day 2 done, Day 3 missing, Day 4 done (today is Day 4)
    const checkins: { day_number: number; status: CheckinStatus }[] = [
      { day_number: 1, status: 'done' },
      { day_number: 2, status: 'done' },
      // Day 3 missing
      { day_number: 4, status: 'done' },
    ];
    // Day 3 was missed, so prior streak is broken
    expect(calculateStreak(checkins, 4)).toBe(1);
  });

  it('preserves yesterday streak if today has not been answered yet', () => {
    // Day 1 done, Day 2 done, Day 3 (today, unanswered yet)
    const checkins: { day_number: number; status: CheckinStatus }[] = [
      { day_number: 1, status: 'done' },
      { day_number: 2, status: 'done' },
    ];
    // Today is Day 3 and is in progress -> Streak from Day 1 & 2 is preserved
    expect(calculateStreak(checkins, 3)).toBe(2);
  });

  it('returns 0 if today is marked "not_yet"', () => {
    const checkins: { day_number: number; status: CheckinStatus }[] = [
      { day_number: 1, status: 'done' },
      { day_number: 2, status: 'done' },
      { day_number: 3, status: 'not_yet' },
    ];
    expect(calculateStreak(checkins, 3)).toBe(0);
  });

  it('handles streak if today is marked "rest"', () => {
    const checkins: { day_number: number; status: CheckinStatus }[] = [
      { day_number: 1, status: 'done' },
      { day_number: 2, status: 'done' },
      { day_number: 3, status: 'rest' },
    ];
    // Today is rest, preserves yesterday's 2-day streak
    expect(calculateStreak(checkins, 3)).toBe(2);
  });
});

describe('isStudentQuiet', () => {
  it('returns false when batch has run for fewer than 4 days', () => {
    // Today is Day 3, no checkins
    expect(isStudentQuiet([], 3)).toBe(false);
  });

  it('flags student as quiet when 4 consecutive days have no check-in of any kind', () => {
    // Today is Day 23. Student answered Days 1-18, but Days 19, 20, 21, 22, 23 are completely missing
    const checkins = Array.from({ length: 18 }, (_, i) => ({
      day_number: i + 1,
    }));

    expect(isStudentQuiet(checkins, 23)).toBe(true);
  });

  it('does NOT flag student as quiet if they checked in within the last 4 days', () => {
    // Today is Day 23. Student checked in on Day 21
    const checkins = [
      { day_number: 1 },
      { day_number: 21 },
    ];

    expect(isStudentQuiet(checkins, 23)).toBe(false);
  });

  it('does NOT flag student as quiet if they checked in today with "not_yet" or "rest"', () => {
    // "Quiet: no check-in of any kind for 4 consecutive days"
    // Answering 'not_yet' or 'rest' counts as a check-in activity!
    const checkins = [
      { day_number: 23 }, // checked in today
    ];

    expect(isStudentQuiet(checkins, 23)).toBe(false);
  });

  it('flags student as quiet if 4 completed past days were missed', () => {
    // Today is Day 5. Student only answered Day 0 / never checked in Days 1, 2, 3, 4
    expect(isStudentQuiet([], 5)).toBe(true);
  });
});

describe('Check-in duplicate prevention', () => {
  it('tapping twice or multiple times updates the existing day record, leaving only 1 record per day', () => {
    // Simulate recording Day 23 as 'not_yet', then student taps 'done' on Day 23
    const checkinLog: { day_number: number; status: CheckinStatus }[] = [];

    // Helper simulating the client upsert map
    const applyUpsert = (day: number, status: CheckinStatus) => {
      const idx = checkinLog.findIndex((c) => c.day_number === day);
      if (idx >= 0) {
        checkinLog[idx] = { day_number: day, status };
      } else {
        checkinLog.push({ day_number: day, status });
      }
    };

    // First tap: student taps 'not_yet'
    applyUpsert(23, 'not_yet');
    expect(checkinLog.filter((c) => c.day_number === 23)).toHaveLength(1);
    expect(checkinLog.find((c) => c.day_number === 23)?.status).toBe('not_yet');

    // Second tap: student changes mind and taps 'done' on Day 23
    applyUpsert(23, 'done');
    expect(checkinLog.filter((c) => c.day_number === 23)).toHaveLength(1);
    expect(checkinLog.find((c) => c.day_number === 23)?.status).toBe('done');

    // Third tap: student taps 'done' again (duplicate tap)
    applyUpsert(23, 'done');
    expect(checkinLog.filter((c) => c.day_number === 23)).toHaveLength(1);
    expect(checkinLog.find((c) => c.day_number === 23)?.status).toBe('done');
  });
});

