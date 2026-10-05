/**
 * Date and timezone helper utilities for Sadhana Mandala.
 * Standardises day calculations based on batch start_date and organization timezone.
 */

/**
 * Gets today's date string (YYYY-MM-DD) in a specific IANA timezone (e.g. 'Asia/Dubai').
 */
export function getTodayInTimezone(timeZone: string = 'Asia/Dubai'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch (err) {
    console.warn(`Invalid timezone "${timeZone}", falling back to UTC`, err);
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Calculates the current day number (1-indexed) of a batch.
 * Day 1 is the batch start_date.
 * Returns negative or zero if the batch has not started yet.
 */
export function calculateDayNumber(
  startDateStr: string,
  timeZone: string = 'Asia/Dubai'
): number {
  if (!startDateStr) return 1;

  const todayStr = getTodayInTimezone(timeZone);

  const [tYear, tMonth, tDay] = todayStr.split('-').map(Number);
  const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);

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
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(dateObj);
  } catch {
    return dateStr;
  }
}
