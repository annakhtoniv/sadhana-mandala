import { describe, it, expect } from 'vitest';
import {
  calculateDayNumber,
  calculateStreak,
  isQuietStudent,
  getTrailDayStatus,
  upsertCheckinInMemory,
} from '../practiceUtils';
import { getTodayInTimezone } from '../dateUtils';
import type { CheckinStatus } from '../../types/database';

describe('1. Day Number Calculation in Organization Timezone', () => {
  it('returns Day 1 when batch starts today in Asia/Dubai', () => {
    const todayDubai = getTodayInTimezone('Asia/Dubai');
    const day = calculateDayNumber(todayDubai, 'Asia/Dubai');
    expect(day).toBe(1);
  });

  it('returns Day 2 when batch started yesterday', () => {
    const today = new Date();
    today.setUTCDate(today.getUTCDate() - 1);
    const yesterdayStr = today.toISOString().split('T')[0];
    const day = calculateDayNumber(yesterdayStr, 'UTC');
    expect(day).toBe(2);
  });

  it('returns Day 23 when batch started 22 days ago', () => {
    const today = new Date();
    today.setUTCDate(today.getUTCDate() - 22);
    const startStr = today.toISOString().split('T')[0];
    const day = calculateDayNumber(startStr, 'UTC');
    expect(day).toBe(23);
  });

  it('returns 0 or negative when batch start_date is in the future', () => {
    const today = new Date();
    today.setUTCDate(today.getUTCDate() + 1); // Tomorrow
    const tomorrowStr = today.toISOString().split('T')[0];
    const day = calculateDayNumber(tomorrowStr, 'UTC');
    expect(day).toBe(0);

    const futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + 5);
    const futureStr = futureDate.toISOString().split('T')[0];
    const futureDay = calculateDayNumber(futureStr, 'UTC');
    expect(futureDay).toBe(-4);
  });

  it('handles empty or missing start_date gracefully', () => {
    expect(calculateDayNumber('')).toBe(1);
  });
});

describe('2. Streak Calculation Logic', () => {
  it('calculates consecutive "done" days forming the streak', () => {
    const checkins = [
      { day_number: 1, status: 'done' as CheckinStatus },
      { day_number: 2, status: 'done' as CheckinStatus },
      { day_number: 3, status: 'done' as CheckinStatus },
    ];
    expect(calculateStreak(checkins, 3)).toBe(3);
  });

  it('preserves streak across "rest" days (rest neither adds nor breaks)', () => {
    const checkins = [
      { day_number: 1, status: 'done' as CheckinStatus },
      { day_number: 2, status: 'rest' as CheckinStatus }, // Rest day does not break
      { day_number: 3, status: 'done' as CheckinStatus },
    ];
    // Days 1 and 3 are done; Day 2 is rest -> Streak = 2
    expect(calculateStreak(checkins, 3)).toBe(2);
  });

  it('preserves streak across multiple consecutive rest days', () => {
    const checkins = [
      { day_number: 1, status: 'done' as CheckinStatus },
      { day_number: 2, status: 'rest' as CheckinStatus },
      { day_number: 3, status: 'rest' as CheckinStatus },
      { day_number: 4, status: 'done' as CheckinStatus },
    ];
    expect(calculateStreak(checkins, 4)).toBe(2);
  });

  it('yields a streak of 0 if practitioner has only recorded rest days', () => {
    const checkins = [
      { day_number: 1, status: 'rest' as CheckinStatus },
      { day_number: 2, status: 'rest' as CheckinStatus },
    ];
    expect(calculateStreak(checkins, 2)).toBe(0);
  });

  it('"not_yet" breaks the streak', () => {
    const checkins = [
      { day_number: 1, status: 'done' as CheckinStatus },
      { day_number: 2, status: 'done' as CheckinStatus },
      { day_number: 3, status: 'not_yet' as CheckinStatus }, // Breaks streak!
      { day_number: 4, status: 'done' as CheckinStatus },
    ];
    // Streak restarted at Day 4 -> Streak = 1
    expect(calculateStreak(checkins, 4)).toBe(1);
  });

  it('gap days (missing check-ins on passed days) break the streak', () => {
    const checkins = [
      { day_number: 1, status: 'done' as CheckinStatus },
      { day_number: 2, status: 'done' as CheckinStatus },
      // Day 3 missing!
      { day_number: 4, status: 'done' as CheckinStatus },
    ];
    // Day 3 was a gap day, so streak restarted at Day 4 -> Streak = 1
    expect(calculateStreak(checkins, 4)).toBe(1);
  });

  it('preserves yesterday\'s streak if today has not been answered yet', () => {
    const checkins = [
      { day_number: 1, status: 'done' as CheckinStatus },
      { day_number: 2, status: 'done' as CheckinStatus },
      // Today is Day 3, no check-in yet
    ];
    expect(calculateStreak(checkins, 3)).toBe(2);
  });

  it('resets streak to 0 if today was answered with "not_yet"', () => {
    const checkins = [
      { day_number: 1, status: 'done' as CheckinStatus },
      { day_number: 2, status: 'done' as CheckinStatus },
      { day_number: 3, status: 'not_yet' as CheckinStatus }, // Today answered not_yet
    ];
    expect(calculateStreak(checkins, 3)).toBe(0);
  });

  it('preserves yesterday\'s streak if today is answered with "rest"', () => {
    const checkins = [
      { day_number: 1, status: 'done' as CheckinStatus },
      { day_number: 2, status: 'done' as CheckinStatus },
      { day_number: 3, status: 'rest' as CheckinStatus }, // Today answered rest
    ];
    expect(calculateStreak(checkins, 3)).toBe(2);
  });

  it('returns 0 for empty checkins array', () => {
    expect(calculateStreak([])).toBe(0);
    expect(calculateStreak([], 5)).toBe(0);
  });

  it('returns 0 if batch has not started yet (currentDay < 1)', () => {
    const checkins = [{ day_number: 1, status: 'done' as CheckinStatus }];
    expect(calculateStreak(checkins, 0)).toBe(0);
  });
});

describe('3. Quiet Student Detection Logic', () => {
  it('flags student as Quiet when no check-in of any kind for 4 consecutive days up to current day', () => {
    // Current day is 23; checkins exist up to Day 19.
    // Days 20, 21, 22, 23 (4 consecutive days) have no check-in!
    const checkins = [
      { day_number: 17 },
      { day_number: 18 },
      { day_number: 19 },
    ];
    expect(isQuietStudent(checkins, 23)).toBe(true);
  });

  it('flags student as Quiet for 5 consecutive missing days (like the seed data)', () => {
    // Checked in up to Day 18; current day is 23.
    // Days 19, 20, 21, 22, 23 = 5 silent days.
    const checkins = [
      { day_number: 1 },
      { day_number: 18 },
    ];
    expect(isQuietStudent(checkins, 23)).toBe(true);
  });

  it('does NOT flag student as Quiet if silent for only 3 consecutive days', () => {
    // Current day is 23; checked in on Day 20.
    // Days 21, 22, 23 = 3 silent days (< 4).
    const checkins = [
      { day_number: 18 },
      { day_number: 19 },
      { day_number: 20 },
    ];
    expect(isQuietStudent(checkins, 23)).toBe(false);
  });

  it('does NOT flag student as Quiet if student checked in today', () => {
    const checkins = [{ day_number: 23 }];
    expect(isQuietStudent(checkins, 23)).toBe(false);
  });

  it('any check-in ("not_yet" or "rest") prevents quiet status', () => {
    // Answering "not_yet" is still a check-in (not quiet)
    const checkins = [
      { day_number: 21 }, // Checked in on Day 21
    ];
    // Missing days: 22, 23 (only 2 days)
    expect(isQuietStudent(checkins, 23)).toBe(false);
  });

  it('does NOT flag student as Quiet during first 3 days of a batch', () => {
    // Batch only on Day 3: cannot be quiet yet even with 0 check-ins
    expect(isQuietStudent([], 1)).toBe(false);
    expect(isQuietStudent([], 2)).toBe(false);
    expect(isQuietStudent([], 3)).toBe(false);
  });

  it('flags student as Quiet if no check-in on Day 4 of batch', () => {
    // Days 1, 2, 3, 4 without check-in = 4 days
    expect(isQuietStudent([], 4)).toBe(true);
  });
});

describe('4. Single Row Idempotency & Upsert Logic', () => {
  it('appends a new checkin when no record exists for that day', () => {
    const existing = [
      { id: '1', batch_id: 'b1', student_id: 's1', day_number: 1, status: 'done' as CheckinStatus },
    ];
    const newEntry = {
      id: '2',
      batch_id: 'b1',
      student_id: 's1',
      day_number: 2,
      status: 'done' as CheckinStatus,
    };

    const result = upsertCheckinInMemory(existing, newEntry);
    expect(result.length).toBe(2);
    expect(result[1].day_number).toBe(2);
  });

  it('tapping twice with same answer updates today and never duplicates the row', () => {
    const existing = [
      { id: '1', batch_id: 'b1', student_id: 's1', day_number: 1, status: 'done' as CheckinStatus },
    ];

    // Second tap with same status
    const secondTap = {
      id: '1-updated',
      batch_id: 'b1',
      student_id: 's1',
      day_number: 1,
      status: 'done' as CheckinStatus,
    };

    const result = upsertCheckinInMemory(existing, secondTap);
    expect(result.length).toBe(1);
    expect(result[0].day_number).toBe(1);
    expect(result[0].status).toBe('done');
  });

  it('changing answer updates status in place without creating extra rows', () => {
    const existing = [
      { id: '1', batch_id: 'b1', student_id: 's1', day_number: 1, status: 'not_yet' as CheckinStatus },
    ];

    // Student changes mind later today: "not_yet" -> "done"
    const changedAnswer = {
      id: '1',
      batch_id: 'b1',
      student_id: 's1',
      day_number: 1,
      status: 'done' as CheckinStatus,
    };

    const result = upsertCheckinInMemory(existing, changedAnswer);
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('done');
  });

  it('maintains strict day_number ordering', () => {
    const existing = [
      { day_number: 3, status: 'done' as CheckinStatus },
      { day_number: 1, status: 'done' as CheckinStatus },
    ];
    const newDay = { day_number: 2, status: 'rest' as CheckinStatus };

    const result = upsertCheckinInMemory(existing, newDay);
    expect(result.length).toBe(3);
    expect(result.map((r) => r.day_number)).toEqual([1, 2, 3]);
  });
});

describe('5. Practice Trail Status Mapping', () => {
  it('maps past days accurately to checkin status or missed', () => {
    expect(getTrailDayStatus(1, 5, 'done')).toBe('done');
    expect(getTrailDayStatus(2, 5, 'rest')).toBe('rest');
    expect(getTrailDayStatus(3, 5, 'not_yet')).toBe('not_yet');
    expect(getTrailDayStatus(4, 5, null)).toBe('missed');
    expect(getTrailDayStatus(4, 5, undefined)).toBe('missed');
  });

  it('maps current day to checkin status or today', () => {
    expect(getTrailDayStatus(5, 5, null)).toBe('today');
    expect(getTrailDayStatus(5, 5, 'done')).toBe('done');
    expect(getTrailDayStatus(5, 5, 'rest')).toBe('rest');
    expect(getTrailDayStatus(5, 5, 'not_yet')).toBe('not_yet');
  });

  it('maps future days to future', () => {
    expect(getTrailDayStatus(6, 5, null)).toBe('future');
    expect(getTrailDayStatus(40, 5, null)).toBe('future');
  });
});
