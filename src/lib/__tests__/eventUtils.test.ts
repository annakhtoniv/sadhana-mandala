import { describe, it, expect } from 'vitest';
import {
  attendanceSummary,
  attendeeName,
  checkInOpen,
  eventEnd,
  eventTiming,
  placesLeft,
  sortEvents,
  validateEventInput,
  type EventInput,
} from '../eventUtils';

const NOW = new Date('2026-10-12T15:00:00Z');
const at = (iso: string) => ({ starts_at: iso, ends_at: null as string | null });

describe('eventEnd and eventTiming', () => {
  it('uses the end time, or 6 hours after the start', () => {
    expect(eventEnd({ starts_at: '2026-10-12T15:00:00Z', ends_at: '2026-10-12T16:00:00Z' }).toISOString()).toBe('2026-10-12T16:00:00.000Z');
    expect(eventEnd(at('2026-10-12T15:00:00Z')).toISOString()).toBe('2026-10-12T21:00:00.000Z');
  });

  it('tells upcoming, ongoing and past events apart', () => {
    expect(eventTiming(at('2026-10-15T15:00:00Z'), NOW)).toBe('upcoming');
    expect(eventTiming({ starts_at: '2026-10-12T14:30:00Z', ends_at: '2026-10-12T16:00:00Z' }, NOW)).toBe('ongoing');
    expect(eventTiming({ starts_at: '2026-10-07T15:00:00Z', ends_at: '2026-10-07T16:00:00Z' }, NOW)).toBe('past');
  });
});

describe('checkInOpen', () => {
  const event = { starts_at: '2026-10-12T17:00:00Z', ends_at: '2026-10-12T18:00:00Z' };

  it('opens 2 hours before the start', () => {
    expect(checkInOpen(event, new Date('2026-10-12T14:59:00Z'))).toBe(false);
    expect(checkInOpen(event, new Date('2026-10-12T15:00:00Z'))).toBe(true);
  });

  it('closes at the end', () => {
    expect(checkInOpen(event, new Date('2026-10-12T18:00:00Z'))).toBe(true);
    expect(checkInOpen(event, new Date('2026-10-12T18:01:00Z'))).toBe(false);
  });
});

describe('placesLeft', () => {
  it('returns null without a limit and never goes below zero', () => {
    expect(placesLeft(null, 50)).toBeNull();
    expect(placesLeft(30, 8)).toBe(22);
    expect(placesLeft(2, 3)).toBe(0);
  });
});

describe('attendanceSummary', () => {
  it('counts each status and the places taken', () => {
    const regs = [
      { status: 'attended' as const }, { status: 'attended' as const }, { status: 'registered' as const },
      { status: 'no_show' as const }, { status: 'cancelled' as const },
    ];
    expect(attendanceSummary(regs)).toEqual({ registered: 1, attended: 2, no_show: 1, cancelled: 1, taken: 3 });
  });
});

describe('attendeeName', () => {
  it('prefers the member name, then the guest name', () => {
    expect(attendeeName({ guest_name: null, profile: { id: '1', full_name: 'Aarav Mehta', email: 'a@example.com' } })).toBe('Aarav Mehta');
    expect(attendeeName({ guest_name: 'Guest Rania', profile: null })).toBe('Guest Rania');
  });
});

describe('sortEvents', () => {
  it('lists coming events soonest first, then past events most recent first', () => {
    const events = [
      { id: 'past-old', ...at('2026-10-01T15:00:00Z') },
      { id: 'next-week', ...at('2026-10-19T15:00:00Z') },
      { id: 'past-recent', ...at('2026-10-07T15:00:00Z') },
      { id: 'tomorrow', ...at('2026-10-13T15:00:00Z') },
    ];
    expect(sortEvents(events, NOW).map((e) => e.id)).toEqual(['tomorrow', 'next-week', 'past-recent', 'past-old']);
  });
});

describe('validateEventInput', () => {
  const input = (over: Partial<EventInput> = {}): EventInput => ({
    kind: 'intro_talk',
    title: 'Introduction to the Happiness Program',
    description: '',
    starts_at: '2026-10-15T19:00',
    ends_at: '2026-10-15T20:00',
    venue: 'Community centre',
    online_url: '',
    capacity: 30,
    course_id: null,
    published: true,
    ...over,
  });

  it('accepts a valid event', () => {
    expect(validateEventInput(input())).toEqual([]);
    expect(validateEventInput(input({ venue: '', online_url: 'https://example.com/live', capacity: null, ends_at: '' }))).toEqual([]);
  });

  it('needs a title, a start, and a venue or online link', () => {
    expect(validateEventInput(input({ title: '' }))).toHaveLength(1);
    expect(validateEventInput(input({ starts_at: '' }))).toHaveLength(1);
    expect(validateEventInput(input({ venue: '', online_url: '' }))).toHaveLength(1);
  });

  it('rejects an end before the start, a non-https link and a zero capacity', () => {
    expect(validateEventInput(input({ ends_at: '2026-10-15T18:00' }))).toHaveLength(1);
    expect(validateEventInput(input({ online_url: 'http://example.com' }))).toHaveLength(1);
    expect(validateEventInput(input({ capacity: 0 }))).toHaveLength(1);
  });
});
