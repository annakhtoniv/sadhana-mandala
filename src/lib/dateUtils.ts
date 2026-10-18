import { currentLocale } from '../i18n/locale';
/**
 * Date and timezone helper utilities for Sadhana Mandala.
 * Standardises day calculations based on batch start_date and organization timezone.
 */

/**
 * Normalizes any date string (including ISO-8601 with time) to YYYY-MM-DD.
 */
export function normalizeDateString(dateStr: string): string {
  if (!dateStr) return '';
  let clean = dateStr.trim();
  if (clean.includes('T')) {
    clean = clean.split('T')[0];
  } else if (clean.includes(' ')) {
    clean = clean.split(' ')[0];
  }
  return clean;
}

/**
 * Gets today's date string (YYYY-MM-DD) in a specific IANA timezone (e.g. 'Asia/Dubai').
 * Allows passing an optional reference Date for deterministic testing and midnight calculations.
 */
export function getTodayInTimezone(
  timeZone: string = 'Asia/Dubai',
  refDate: Date = new Date()
): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(refDate);
  } catch (err) {
    console.warn(`Invalid timezone "${timeZone}", falling back to UTC`, err);
    return refDate.toISOString().split('T')[0];
  }
}

/**
 * Calculates the current day number (1-indexed) of a batch.
 * Day 1 is the batch start_date.
 * Returns negative or zero if the batch has not started yet.
 * Supports ISO timestamps (e.g. "2026-10-08T00:00:00Z") and reference date for timezone rollover tests.
 */
export function calculateDayNumber(
  startDateStr: string,
  timeZone: string = 'Asia/Dubai',
  refDate?: Date
): number {
  if (!startDateStr) return 1;

  const todayStr = getTodayInTimezone(timeZone, refDate);
  const normalizedStart = normalizeDateString(startDateStr);

  const [tYear, tMonth, tDay] = todayStr.split('-').map((n) => parseInt(n, 10));
  const [sYear, sMonth, sDay] = normalizedStart.split('-').map((n) => parseInt(n, 10));

  if (isNaN(sYear) || isNaN(sMonth) || isNaN(sDay)) {
    return 1;
  }

  const todayUtc = Date.UTC(tYear, tMonth - 1, tDay);
  const startUtc = Date.UTC(sYear, sMonth - 1, sDay);

  const diffMs = todayUtc - startUtc;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays + 1; // Day 1 is the start_date
}

/**
 * Formats a date string for user display in the given timezone.
 */
export function formatDateDisplay(
  dateStr: string,
  timeZone: string = 'Asia/Dubai'
): string {
  if (!dateStr) return '';
  try {
    const normalized = normalizeDateString(dateStr);
    const [year, month, day] = normalized.split('-').map((n) => parseInt(n, 10));
    if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;

    const dateObj = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat(currentLocale(), {
      timeZone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(dateObj);
  } catch {
    return dateStr;
  }
}

/**
 * An instant shown as "YYYY-MM-DDTHH:mm" wall-clock time in a time zone
 * (the value format of <input type="datetime-local">).
 */
export function isoToZonedInput(iso: string | null, timeZone: string): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Offset of a time zone from UTC at an instant, in milliseconds (Dubai: +4h). */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const asZoned = isoToZonedInput(new Date(utcMs).toISOString(), timeZone);
  const [date, time] = asZoned.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, min) - Math.floor(utcMs / 60000) * 60000;
}

/**
 * "YYYY-MM-DDTHH:mm" wall-clock time in a time zone -> ISO instant.
 * Lets a teacher type event times in the organisation's time zone whatever
 * time zone their phone is set to.
 */
export function zonedInputToIso(local: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  // The two offsets around this moment (they differ only on a daylight-saving change day)
  const candidates = [guess - zoneOffsetMs(guess - 12 * 3600_000, timeZone), guess - zoneOffsetMs(guess + 12 * 3600_000, timeZone)];
  // The earliest one that shows the same wall-clock time (a repeated hour: its first time)
  const exact = candidates
    .filter((utc) => isoToZonedInput(new Date(utc).toISOString(), timeZone) === local.slice(0, 16))
    .sort((a, b) => a - b)[0];
  // A time that does not exist (the hour skipped in spring) moves forward, as clocks do
  const utc = exact ?? Math.max(...candidates);
  return new Date(utc).toISOString();
}
