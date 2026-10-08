import type { CheckinStatus } from '../types/database';
import { calculateDayNumber as calcDayNumberFromDate } from './dateUtils';

/**
 * Re-export day number calculation using organization timezone.
 * Batch start_date is Day 1.
 */
export function calculateDayNumber(
  startDateStr: string,
  timeZone: string = 'Asia/Dubai'
): number {
  return calcDayNumberFromDate(startDateStr, timeZone);
}

/**
 * Visual trail status for a day in the practice trail.
 */
export type DayTrailStatus = 'done' | 'not_yet' | 'rest' | 'missed' | 'today' | 'future';

/**
 * Determines the status of a specific day in the practice trail.
 *
 * @param dayNumber The 1-indexed day number of the practice trail
 * @param currentDay The current active day number of the batch
 * @param checkinStatus The check-in status recorded for that day, if any
 */
export function getTrailDayStatus(
  dayNumber: number,
  currentDay: number,
  checkinStatus?: CheckinStatus | null
): DayTrailStatus {
  // If a check-in exists for this day, reflect its recorded status
  if (checkinStatus) {
    return checkinStatus;
  }

  // Today with no check-in yet
  if (dayNumber === currentDay) {
    return 'today';
  }

  // A passed day with no check-in is missed
  if (dayNumber < currentDay) {
    return 'missed';
  }

  // Future day not reached yet
  return 'future';
}

/**
 * Calculates current practice streak count.
 *
 * Business Rules (per SPEC.md):
 * - Consecutive "done" days form the streak.
 * - A "rest" day neither adds to nor breaks the streak.
 * - A passed day with "not_yet" or no check-in breaks the streak.
 * - An unanswered "today" does not break yesterday's streak (today is still in progress).
 * - An answered "not_yet" today breaks the streak (streak is 0).
 * - An answered "rest" today preserves yesterday's streak without incrementing.
 * - An answered "done" today increments the streak.
 *
 * @param checkins Array of check-in records containing day_number and status
 * @param currentDay The current day number of the batch. Defaults to highest day_number in checkins or 1.
 * @returns The consecutive 'done' streak count
 */
export function calculateStreak(
  checkins: Array<{ day_number: number; status: CheckinStatus }>,
  currentDay?: number
): number {
  if (!checkins || checkins.length === 0) {
    return 0;
  }

  // Create a fast lookup map of day_number -> status
  const checkinMap = new Map<number, CheckinStatus>();
  for (const c of checkins) {
    checkinMap.set(c.day_number, c.status);
  }

  // Determine effective currentDay
  const maxRecordedDay = Math.max(...checkins.map((c) => c.day_number));
  const effectiveCurrentDay = currentDay !== undefined ? currentDay : Math.max(maxRecordedDay, 1);

  if (effectiveCurrentDay < 1) {
    return 0;
  }

  let streak = 0;

  // Check today (effectiveCurrentDay) first:
  // - If today has 'done', streak starts at 1, then we look back into past days.
  // - If today has 'rest', streak starts at 0, and we look back into past days (rest neither adds nor breaks).
  // - If today has 'not_yet', the streak is broken today (return 0).
  // - If today has no check-in yet, today is not passed, so streak can continue from yesterday.
  const todayStatus = checkinMap.get(effectiveCurrentDay);

  if (todayStatus === 'not_yet') {
    return 0;
  }

  if (todayStatus === 'done') {
    streak += 1;
  }

  // Now scan backwards through all passed days (effectiveCurrentDay - 1 down to 1)
  for (let d = effectiveCurrentDay - 1; d >= 1; d--) {
    const status = checkinMap.get(d);

    if (status === 'done') {
      streak += 1;
    } else if (status === 'rest') {
      // Rest day neither adds to nor breaks the streak; continue scanning backwards
      continue;
    } else {
      // 'not_yet' or missing check-in (gap day) breaks the streak
      break;
    }
  }

  return streak;
}

/**
 * Detects whether a student has gone "Quiet".
 *
 * Business Rule (per SPEC.md):
 * "Quiet: no check-in of any kind for 4 consecutive days."
 * Evaluated up to the current batch day.
 *
 * @param checkins Array of check-in records
 * @param currentDay The current day number of the batch
 * @param thresholdDays Number of consecutive silent days to trigger quiet flag (default 4)
 * @returns boolean true if student has no check-in of any kind for `thresholdDays` consecutive days up to currentDay
 */
export function isQuietStudent(
  checkins: Array<{ day_number: number }>,
  currentDay: number,
  thresholdDays: number = 4
): boolean {
  // If the batch hasn't run for at least thresholdDays, cannot be quiet yet
  if (currentDay < thresholdDays) {
    return false;
  }

  const checkinDays = new Set(checkins.map((c) => c.day_number));

  // Count consecutive days without check-in starting from currentDay going backwards
  let consecutiveQuietDays = 0;
  for (let d = currentDay; d >= 1; d--) {
    if (!checkinDays.has(d)) {
      consecutiveQuietDays++;
      if (consecutiveQuietDays >= thresholdDays) {
        return true;
      }
    } else {
      // Encountered any check-in; the consecutive quiet streak ending at currentDay is terminated
      break;
    }
  }

  return consecutiveQuietDays >= thresholdDays;
}

/**
 * Idempotently updates or appends a check-in in an in-memory list.
 * Guarantees that updating or tapping twice updates today's record and never duplicates it.
 *
 * @param existingCheckins Current list of check-ins
 * @param newCheckin The check-in to upsert
 * @returns Updated array of check-ins with exactly one record for this day
 */
export function upsertCheckinInMemory<
  T extends { day_number: number; status: CheckinStatus; updated_at?: string; [key: string]: any }
>(
  existingCheckins: T[],
  newCheckin: T
): T[] {
  const index = existingCheckins.findIndex((c) => c.day_number === newCheckin.day_number);

  if (index >= 0) {
    const updated = [...existingCheckins];
    updated[index] = {
      ...updated[index],
      ...newCheckin,
      updated_at: newCheckin.updated_at || new Date().toISOString(),
    };
    return updated;
  }

  return [...existingCheckins, newCheckin].sort((a, b) => a.day_number - b.day_number);
}
