import type { CheckinStatus } from '../types/database';
import { calculateDayNumber as calcDayNumberFromDate } from './dateUtils';

/**
 * Daily practice rules (PM decision 2026-10-18):
 * - Each day has two ticks: Morning and Evening. There are no rest days.
 * - A day counts (streak, trail, reports) when at least one tick is set.
 * - A student may check in for any past day of the batch (marked "late").
 */

/** What a check-in row needs for the practice rules (older rows only have status). */
export interface PracticeMark {
  day_number: number;
  morning?: boolean | null;
  evening?: boolean | null;
  status?: CheckinStatus | null;
}

/**
 * Batch start_date is Day 1, in the organisation time zone.
 * Allows passing an optional reference Date for deterministic testing.
 */
export function calculateDayNumber(
  startDateStr: string,
  timeZone: string = 'Asia/Dubai',
  refDate?: Date
): number {
  return calcDayNumberFromDate(startDateStr, timeZone, refDate);
}

export function hasMorning(c: PracticeMark | null | undefined): boolean {
  if (!c) return false;
  if (c.morning === undefined || c.morning === null) return c.status === 'done'; // row from before the ticks
  return c.morning;
}

export function hasEvening(c: PracticeMark | null | undefined): boolean {
  return Boolean(c?.evening);
}

/** The day counts when morning or evening is ticked. */
export function isPractised(c: PracticeMark | null | undefined): boolean {
  return hasMorning(c) || hasEvening(c);
}

/**
 * How a day looks on the practice trail:
 * full = morning and evening, half = one of them, missed = a passed day
 * without a tick, today = today without a tick yet, future = not reached.
 */
export type DayTrailStatus = 'full' | 'half' | 'missed' | 'today' | 'future';

export function getTrailDayStatus(dayNumber: number, currentDay: number, checkin?: PracticeMark | null): DayTrailStatus {
  const m = hasMorning(checkin);
  const e = hasEvening(checkin);
  if (m && e) return 'full';
  if (m || e) return 'half';
  if (dayNumber === currentDay) return 'today';
  if (dayNumber < currentDay) return 'missed';
  return 'future';
}

/**
 * Current streak: consecutive practised days ending today (or yesterday, if
 * today has no tick yet: today is still in progress). For a finished batch it
 * is counted up to the last day of the practice.
 */
export function calculateStreak(checkins: PracticeMark[], currentDay?: number, durationDays?: number): number {
  if (!checkins || checkins.length === 0) return 0;
  const practised = new Set(checkins.filter(isPractised).map((c) => c.day_number));

  let day = currentDay !== undefined ? currentDay : Math.max(1, ...checkins.map((c) => c.day_number));
  if (durationDays !== undefined && durationDays > 0 && day > durationDays) day = durationDays;
  if (day < 1) return 0;

  let streak = 0;
  if (practised.has(day)) streak += 1;
  for (let d = day - 1; d >= 1; d--) {
    if (!practised.has(d)) break;
    streak += 1;
  }
  return streak;
}

/** Practised days so far (for "x of 40"). */
export function countPractisedDays(checkins: PracticeMark[], upToDay?: number): number {
  return checkins.filter((c) => isPractised(c) && (upToDay === undefined || c.day_number <= upToDay)).length;
}

/**
 * Quiet: no practised day for `thresholdDays` full days in a row. Like the
 * streak, today only counts once it is over: a student who has not ticked yet
 * this morning is not counted as silent for today.
 */
export function isQuietStudent(
  checkins: PracticeMark[],
  currentDay: number,
  thresholdDays: number = 4,
  durationDays?: number
): boolean {
  const practised = new Set(checkins.filter(isPractised).map((c) => c.day_number));
  let day = currentDay;
  const finished = durationDays !== undefined && durationDays > 0 && day > durationDays;
  if (finished) day = durationDays as number;
  else if (!practised.has(day)) day -= 1; // today is not over yet
  if (day < thresholdDays) return false;

  let silent = 0;
  for (let d = day; d >= 1; d--) {
    if (practised.has(d)) break;
    silent += 1;
    if (silent >= thresholdDays) return true;
  }
  return false;
}

/**
 * Idempotently updates or appends a check-in in an in-memory list: one record
 * per day, keeping the database id and created_at of an existing day.
 */
export function upsertCheckinInMemory<
  T extends { day_number: number; id?: string; created_at?: string; updated_at?: string }
>(existingCheckins: T[], newCheckin: T): T[] {
  const index = existingCheckins.findIndex((c) => c.day_number === newCheckin.day_number);
  if (index >= 0) {
    const updated = [...existingCheckins];
    const existing = updated[index];
    updated[index] = {
      ...existing,
      ...newCheckin,
      id: existing.id || newCheckin.id,
      created_at: existing.created_at || newCheckin.created_at || new Date().toISOString(),
      updated_at: newCheckin.updated_at || new Date().toISOString(),
    };
    return updated;
  }
  return [...existingCheckins, newCheckin].sort((a, b) => a.day_number - b.day_number);
}
