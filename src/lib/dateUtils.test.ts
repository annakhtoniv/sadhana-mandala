import { describe, it, expect } from 'vitest';
import { calculateDayNumber, getTodayInTimezone } from './dateUtils';

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
