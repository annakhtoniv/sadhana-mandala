import { describe, expect, it } from 'vitest';
import { motivationLine } from '../../../supabase/functions/send-reminders/motivation';

const base = { practice_day: 10, duration_days: 40, week_number: 2, week_done: 2, week_open_days: 3, week_unbroken: true, today_morning: false, today_evening: false };

describe('reminder motivation (Phase 21)', () => {
  it('cheers on an unbroken week', () => {
    expect(motivationLine('morning', base)).toBe('Day 10 · 2 of 7 days this week. Keep week 2 unbroken 🔥');
  });
  it('names the badge on the last day of a week', () => {
    expect(motivationLine('morning', { ...base, practice_day: 14, week_done: 6 })).toContain('earn your badge');
  });
  it('is kind after a missed day', () => {
    expect(motivationLine('morning', { ...base, week_unbroken: false })).toContain('fresh streak');
  });
  it('knows when a practice is already ticked', () => {
    expect(motivationLine('morning', { ...base, today_morning: true })).toContain('Morning already ticked');
    expect(motivationLine('evening', { ...base, today_morning: true })).toMatch(/^Morning done ✓ /);
  });
  it('counts down the last, shorter week', () => {
    expect(motivationLine('morning', { ...base, practice_day: 38, week_number: 6 })).toBe('Day 38 of 40: 3 days left to complete your whole practice 🌟');
  });
  it('adds nothing without week details (older database)', () => {
    expect(motivationLine('morning', {})).toBeNull();
  });
});
