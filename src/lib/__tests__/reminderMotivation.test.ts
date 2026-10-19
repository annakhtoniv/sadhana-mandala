import { describe, expect, it } from 'vitest';
import { motivationLine, reminderText, skipReminder } from '../../../supabase/functions/send-reminders/motivation';

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

describe('reminders in the student\'s language and the quiet evening (Phase 22)', () => {
  const stock = { reminder_morning_text: 'Good morning. Time for your morning practice.', reminder_evening_text: 'Time for your evening practice.' };

  it('uses the admin\'s text for that language, else the stock translation, else English', () => {
    expect(reminderText('morning', { ...stock, reminder_morning_text_ar: 'صباح النور' }, 'ar', '')).toBe('صباح النور');
    expect(reminderText('evening', stock, 'hi', '')).toBe('आपके शाम के अभ्यास का समय है।');
    expect(reminderText('morning', { reminder_morning_text: 'Rise and shine.' }, 'ar', '')).toBe('Rise and shine.');
    expect(reminderText('morning', stock, 'en', '')).toBe(stock.reminder_morning_text);
  });

  it('writes the week line in Arabic and Hindi', () => {
    expect(motivationLine('morning', { ...base, lang: 'ar' })).toContain('الأسبوع 2');
    expect(motivationLine('morning', { ...base, lang: 'hi' })).toContain('सप्ताह 2');
  });

  it('skips the Evening reminder once today has a tick', () => {
    expect(skipReminder('evening', { ...base, today_morning: true })).toBe(true);
    expect(skipReminder('evening', base)).toBe(false);
    expect(skipReminder('morning', { ...base, today_morning: true })).toBe(false);
  });
});
