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
/** morning / evening: only that practice was ticked (top / bottom half of the circle) */
export type DayTrailStatus = 'full' | 'morning' | 'evening' | 'missed' | 'today' | 'future';

export function getTrailDayStatus(dayNumber: number, currentDay: number, checkin?: PracticeMark | null): DayTrailStatus {
  const m = hasMorning(checkin);
  const e = hasEvening(checkin);
  if (m && e) return 'full';
  if (m) return 'morning';
  if (e) return 'evening';
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

/**
 * Weekly badges (Phase 21). The practice is counted in weeks of the batch:
 * days 1-7, 8-14, ... A week is complete when every one of its 7 days has a
 * tick (Morning or Evening, also when filled in later; the same rule as the
 * streak). The whole practice is complete when every day has a tick. The
 * database has the same rule (my_earned_badges) and only lets a person use a
 * frame they earned.
 */
export type BadgeId = `week${number}` | 'complete';

/** The week (1, 2, ...) a practice day belongs to. */
export function weekOfDay(day: number): number {
  return Math.floor((Math.max(1, day) - 1) / 7) + 1;
}

/** Full 7-day weeks of a practice (a 40-day practice has 5; days 36 to 40 count for the 40-day badge). */
export function fullWeeks(durationDays: number): number {
  return Math.floor(Math.max(0, durationDays) / 7);
}

export function earnedBadges(checkins: PracticeMark[], durationDays: number): BadgeId[] {
  const practised = new Set(checkins.filter(isPractised).map((c) => c.day_number));
  const out: BadgeId[] = [];
  for (let w = 1; w <= fullWeeks(durationDays); w++) {
    let all = true;
    for (let d = 7 * w - 6; d <= 7 * w; d++) if (!practised.has(d)) all = false;
    if (all) out.push(`week${w}`);
  }
  if (durationDays > 0 && Array.from({ length: durationDays }, (_, i) => i + 1).every((d) => practised.has(d))) out.push('complete');
  return out;
}

export interface WeekProgress {
  week: number;
  /** First and last day of this week (the last week can be shorter) */
  firstDay: number;
  lastDay: number;
  /** Practised days of this week so far */
  done: number;
  /** Days of this week up to today */
  openDays: number;
  /** True while no day of this week has been missed so far (today may still be open) */
  unbroken: boolean;
  /** A full 7-day week (earns a badge) */
  earnsBadge: boolean;
}

/** Where today sits in its week, for the practice card and the reminders. */
export function weekProgress(checkins: PracticeMark[], todayDay: number, durationDays: number): WeekProgress | null {
  if (todayDay < 1 || durationDays < 1) return null;
  const day = Math.min(todayDay, durationDays);
  const week = weekOfDay(day);
  const firstDay = 7 * week - 6;
  const lastDay = Math.min(7 * week, durationDays);
  const practised = new Set(checkins.filter(isPractised).map((c) => c.day_number));
  let done = 0;
  let unbroken = true;
  for (let d = firstDay; d <= day; d++) {
    if (practised.has(d)) done++;
    else if (d < todayDay) unbroken = false; // today is still open
  }
  return { week, firstDay, lastDay, done, openDays: day - firstDay + 1, unbroken, earnsBadge: week <= fullWeeks(durationDays) };
}
