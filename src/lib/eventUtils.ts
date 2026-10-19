import type { EventKind, EventRegistration, OrgEvent, RegistrationStatus } from '../types/database';

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  intro_talk: 'Intro talk',
  programme: 'Programme',
  satsang: 'Satsang',
  followup: 'Follow-up session',
  other: 'Event',
};

export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  registered: 'Registered',
  attended: 'Attended',
  no_show: 'No-show',
  cancelled: 'Cancelled',
};

const HOUR = 60 * 60 * 1000;

/** When an event is over: its end time, or 6 hours after the start (same rule as the database). */
export function eventEnd(event: Pick<OrgEvent, 'starts_at' | 'ends_at'>): Date {
  return event.ends_at ? new Date(event.ends_at) : new Date(new Date(event.starts_at).getTime() + 6 * HOUR);
}

export type EventTiming = 'upcoming' | 'ongoing' | 'past';

export function eventTiming(event: Pick<OrgEvent, 'starts_at' | 'ends_at'>, now: Date = new Date()): EventTiming {
  if (now < new Date(event.starts_at)) return 'upcoming';
  if (now > eventEnd(event)) return 'past';
  return 'ongoing';
}

/** QR check-in is open from 2 hours before the start until the end (mirrors check_in_to_event). */
export function checkInOpen(event: Pick<OrgEvent, 'starts_at' | 'ends_at'>, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(event.starts_at).getTime() - 2 * HOUR && now <= eventEnd(event);
}

/** Places left, or null when the event has no capacity limit. Never below zero. */
export function placesLeft(capacity: number | null, taken: number): number | null {
  if (capacity === null) return null;
  return Math.max(0, capacity - taken);
}

export interface AttendanceSummary {
  registered: number;
  attended: number;
  no_show: number;
  cancelled: number;
  /** Places taken: registered + attended */
  taken: number;
}

export function attendanceSummary(registrations: Pick<EventRegistration, 'status'>[]): AttendanceSummary {
  const summary: AttendanceSummary = { registered: 0, attended: 0, no_show: 0, cancelled: 0, taken: 0 };
  for (const r of registrations) summary[r.status] += 1;
  summary.taken = summary.registered + summary.attended;
  return summary;
}

/** Display name of a registration: the member's name, else the guest's. */
export function attendeeName(r: Pick<EventRegistration, 'guest_name' | 'profile'>): string {
  return r.profile?.full_name || r.profile?.email || r.guest_name || 'Guest';
}

export interface EventInput {
  id?: string;
  kind: EventKind;
  title: string;
  description: string;
  /** datetime-local values, e.g. "2026-10-15T19:00" */
  starts_at: string;
  ends_at: string;
  venue: string;
  online_url: string;
  capacity: number | null;
  course_id: string | null;
  published: boolean;
}

export function validateEventInput(input: EventInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('Please enter a title.');
  const start = input.starts_at ? new Date(input.starts_at) : null;
  if (!start || isNaN(start.getTime())) errors.push('Please choose when the event starts.');
  if (input.ends_at) {
    const end = new Date(input.ends_at);
    if (isNaN(end.getTime())) errors.push('The end time is not valid.');
    else if (start && end <= start) errors.push('The end must be after the start.');
  }
  if (input.online_url.trim() && !/^https:\/\/\S+$/i.test(input.online_url.trim())) {
    errors.push('The online link must start with https://');
  }
  if (!input.venue.trim() && !input.online_url.trim()) errors.push('Please add a venue or an online link.');
  if (input.capacity !== null && (!Number.isInteger(input.capacity) || input.capacity < 1)) {
    errors.push('Capacity must be a whole number, 1 or more (leave it empty for no limit).');
  }
  return errors;
}

/** Upcoming and ongoing events first (soonest first), then past events (most recent first). */
export function sortEvents<T extends Pick<OrgEvent, 'starts_at' | 'ends_at'>>(events: T[], now: Date = new Date()): T[] {
  const live = events.filter((e) => eventTiming(e, now) !== 'past').sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = events.filter((e) => eventTiming(e, now) === 'past').sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return [...live, ...past];
}

export type PlacesSummary =
  | { kind: 'open'; taken: number }
  | { kind: 'left'; left: number; total: number }
  | { kind: 'full'; total: number };

/** One way to say how many places an event has: open to all, some left, or full. */
export function placesSummary(capacity: number | null, taken: number): PlacesSummary {
  if (capacity === null) return { kind: 'open', taken };
  const left = placesLeft(capacity, taken)!;
  return left === 0 ? { kind: 'full', total: capacity } : { kind: 'left', left, total: capacity };
}

// City names people read, for the organisation time zones in use
const CITY_NAMES: Record<string, Record<string, string>> = {
  'Asia/Dubai': { en: 'Dubai', ar: 'دبي', hi: 'दुबई' },
};

/** "Dubai" for Asia/Dubai: the city of a time zone, in the reader's language where known. */
export function timeZoneCity(timeZone: string, lang: string): string {
  return CITY_NAMES[timeZone]?.[lang] || CITY_NAMES[timeZone]?.en || (timeZone.split('/').pop() || timeZone).replace(/_/g, ' ');
}

/** "GMT+4" for Asia/Dubai (at the given moment, so summer time is right). */
export function timeZoneOffset(timeZone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName');
    return part?.value || timeZone;
  } catch {
    return timeZone;
  }
}
