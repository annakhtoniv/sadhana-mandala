import { describe, it, expect } from 'vitest';
import { addDays, calculateDayNumber, formatDateDisplay, formatDateRange, getTodayInTimezone, isoToZonedInput, zonedInputToIso } from './dateUtils';

describe('calculateDayNumber', () => {
  const timezone = 'Asia/Dubai';

  it('calculates Day 1 when start_date equals today in the organisation timezone', () => {
    const today = getTodayInTimezone(timezone);
    const day = calculateDayNumber(today, timezone);
    expect(day).toBe(1);
  });

  it('calculates Day 2 when start_date was yesterday', () => {
    const today = getTodayInTimezone(timezone);
    const [y, m, d] = today.split('-').map(Number);
    const yesterdayDate = new Date(Date.UTC(y, m - 1, d - 1));
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    const day = calculateDayNumber(yesterdayStr, timezone);
    expect(day).toBe(2);
  });

  it('calculates Day 23 when start_date was 22 days ago', () => {
    const today = getTodayInTimezone(timezone);
    const [y, m, d] = today.split('-').map(Number);
    const pastDate = new Date(Date.UTC(y, m - 1, d - 22));
    const pastStr = pastDate.toISOString().split('T')[0];

    const day = calculateDayNumber(pastStr, timezone);
    expect(day).toBe(23);
  });

  it('calculates Day 40 when start_date was 39 days ago', () => {
    const today = getTodayInTimezone(timezone);
    const [y, m, d] = today.split('-').map(Number);
    const pastDate = new Date(Date.UTC(y, m - 1, d - 39));
    const pastStr = pastDate.toISOString().split('T')[0];

    const day = calculateDayNumber(pastStr, timezone);
    expect(day).toBe(40);
  });

  it('returns <= 0 when batch starts in the future', () => {
    const today = getTodayInTimezone(timezone);
    const [y, m, d] = today.split('-').map(Number);
    const futureDate = new Date(Date.UTC(y, m - 1, d + 3));
    const futureStr = futureDate.toISOString().split('T')[0];

    const day = calculateDayNumber(futureStr, timezone);
    expect(day).toBeLessThanOrEqual(0);
  });
});


describe('zoned datetime inputs', () => {
  it('shows an instant as wall-clock time in the organisation time zone', () => {
    expect(isoToZonedInput('2026-10-15T15:00:00.000Z', 'Asia/Dubai')).toBe('2026-10-15T19:00');
    expect(isoToZonedInput(null, 'Asia/Dubai')).toBe('');
  });

  it('reads wall-clock time in the organisation time zone, whatever the device time zone', () => {
    expect(zonedInputToIso('2026-10-15T19:00', 'Asia/Dubai')).toBe('2026-10-15T15:00:00.000Z');
    expect(zonedInputToIso('2026-10-15T00:30', 'Asia/Dubai')).toBe('2026-10-14T20:30:00.000Z');
  });

  it('round-trips, including across a daylight-saving change', () => {
    expect(isoToZonedInput(zonedInputToIso('2026-03-29T03:30', 'Europe/London'), 'Europe/London')).toBe('2026-03-29T03:30');
    expect(zonedInputToIso('2026-07-01T09:00', 'Europe/London')).toBe('2026-07-01T08:00:00.000Z');
  });

  it('rejects malformed input', () => {
    expect(zonedInputToIso('', 'Asia/Dubai')).toBeNull();
    expect(zonedInputToIso('tomorrow', 'Asia/Dubai')).toBeNull();
  });
});

describe('batch date ranges (Phase 20)', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-09-26', 39)).toBe('2026-11-04');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('shows a range, or one date when start and end are the same day', () => {
    expect(formatDateRange('2026-09-26', '2026-11-04', 'Asia/Dubai')).toMatch(/26.*4 Nov 2026/);
    expect(formatDateRange('2026-10-17', '2026-10-17', 'Asia/Dubai')).toBe(formatDateDisplay('2026-10-17', 'Asia/Dubai'));
  });
});
