import { fetchAllPages } from './paging';
import { supabase, isDemoMode } from './supabase';
import type { EventRegistration, OrgEvent, RegistrationStatus } from '../types/database';
import { DEMO_EVENTS, DEMO_EVENT_REGISTRATIONS } from './mockData';
import { sortEvents, type EventInput } from './eventUtils';
import { zonedInputToIso } from './dateUtils';

/** Every column except the secret check-in code (members may not read it). */
const EVENT_COLUMNS =
  'id, org_id, kind, title, description, starts_at, ends_at, venue, online_url, capacity, course_id, batch_id, host_id, published, created_at, updated_at';

const DEMO_MY_EVENTS_KEY = 'sadhana_demo_my_events';
const DEMO_EDIT_ERROR = 'Events cannot be changed in demo mode. Sign in with Google to manage events.';

function readDemoMine(): Record<string, RegistrationStatus> {
  try {
    return JSON.parse(localStorage.getItem(DEMO_MY_EVENTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeDemoMine(value: Record<string, RegistrationStatus>) {
  try {
    localStorage.setItem(DEMO_MY_EVENTS_KEY, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

/** Events of the organisation (members get published ones; staff also drafts), coming first. */
export async function fetchEvents(orgId: string): Promise<OrgEvent[]> {
  if (isDemoMode()) return sortEvents(DEMO_EVENTS);
  const rows = await fetchAllPages<OrgEvent>((from, to) =>
    supabase.from('events').select(EVENT_COLUMNS).eq('org_id', orgId).order('id', { ascending: true }).range(from, to) as unknown as PromiseLike<{ data: OrgEvent[] | null; error: { message: string } | null }>
  );
  return sortEvents(rows);
}

/** Places taken (registered + attended) per event. */
export async function fetchPlacesTaken(eventIds: string[]): Promise<Map<string, number>> {
  const taken = new Map<string, number>();
  if (eventIds.length === 0) return taken;
  if (isDemoMode()) {
    const mine = readDemoMine();
    for (const id of eventIds) {
      const base = DEMO_EVENT_REGISTRATIONS.filter((r) => r.event_id === id).length;
      taken.set(id, base + (mine[id] === 'registered' || mine[id] === 'attended' ? 1 : 0));
    }
    return taken;
  }
  const { data, error } = await supabase.rpc('event_places_taken', { p_event_ids: eventIds });
  if (error) throw new Error(error.message);
  for (const row of (data as { event_id: string; taken: number }[]) || []) taken.set(row.event_id, row.taken);
  return taken;
}

/** The signed-in member's registration status per event. */
export async function fetchMyRegistrations(profileId: string): Promise<Map<string, RegistrationStatus>> {
  if (isDemoMode()) return new Map(Object.entries(readDemoMine()));
  const { data, error } = await supabase.from('event_registrations').select('event_id, status').eq('profile_id', profileId);
  if (error) throw new Error(error.message);
  return new Map(((data as { event_id: string; status: RegistrationStatus }[]) || []).map((r) => [r.event_id, r.status]));
}

type RpcResult = { success: boolean; message?: string; title?: string };

async function callRpc(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { success: false, message: error.message };
  return (data as RpcResult) || { success: false, message: 'No answer from the server.' };
}

export async function registerForEvent(eventId: string): Promise<RpcResult> {
  if (isDemoMode()) {
    writeDemoMine({ ...readDemoMine(), [eventId]: 'registered' });
    return { success: true };
  }
  return callRpc('register_for_event', { p_event_id: eventId });
}

export async function cancelMyRegistration(eventId: string): Promise<RpcResult> {
  if (isDemoMode()) {
    writeDemoMine({ ...readDemoMine(), [eventId]: 'cancelled' });
    return { success: true };
  }
  return callRpc('cancel_my_registration', { p_event_id: eventId });
}

/** QR check-in: the code comes from the event's QR link (?event=CODE). */
export async function checkInToEvent(code: string): Promise<RpcResult> {
  if (isDemoMode()) return { success: false, message: 'Check-in is not available in demo mode.' };
  return callRpc('check_in_to_event', { p_code: code });
}

/**
 * Creates or updates an event. Form times are wall-clock times in the
 * organisation's time zone, whatever time zone the teacher's phone uses.
 */
export async function saveEvent(
  orgId: string,
  userId: string,
  input: EventInput,
  timeZone: string
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: DEMO_EDIT_ERROR };
  const row = {
    kind: input.kind,
    title: input.title.trim(),
    description: input.description.trim() || null,
    starts_at: zonedInputToIso(input.starts_at, timeZone),
    ends_at: input.ends_at ? zonedInputToIso(input.ends_at, timeZone) : null,
    venue: input.venue.trim() || null,
    online_url: input.online_url.trim() || null,
    capacity: input.capacity,
    course_id: input.course_id,
    published: input.published,
    updated_at: new Date().toISOString(),
  };
  const { error } = input.id
    ? await supabase.from('events').update(row).eq('id', input.id)
    : await supabase.from('events').insert({ ...row, org_id: orgId, host_id: userId, created_by: userId });
  return error ? { success: false, error: error.message } : { success: true };
}

/** Deletes an event and all its registrations. */
export async function deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: DEMO_EDIT_ERROR };
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  return error ? { success: false, error: error.message } : { success: true };
}

/** Everyone registered for an event (staff only). */
export async function fetchEventRegistrations(eventId: string): Promise<EventRegistration[]> {
  if (isDemoMode()) return DEMO_EVENT_REGISTRATIONS.filter((r) => r.event_id === eventId);
  const { data, error } = await supabase
    .from('event_registrations')
    .select('*, profile:profiles!event_registrations_profile_id_fkey(id, full_name, email)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as unknown as EventRegistration[]) || [];
}

/** The secret check-in code for an event's QR (staff only). */
export async function fetchCheckinCode(eventId: string): Promise<string | null> {
  if (isDemoMode()) return 'DEMO1234';
  const { data, error } = await supabase.rpc('event_checkin_code', { p_event_id: eventId });
  if (error) throw new Error(error.message);
  return (data as string) || null;
}

export async function addGuest(
  orgId: string,
  userId: string,
  eventId: string,
  guest: { name: string; email: string; phone: string }
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: DEMO_EDIT_ERROR };
  const { error } = await supabase.from('event_registrations').insert({
    org_id: orgId,
    event_id: eventId,
    guest_name: guest.name.trim(),
    guest_email: guest.email.trim().toLowerCase() || null,
    guest_phone: guest.phone.trim() || null,
    status: 'registered',
    added_by: userId,
  });
  if (error) {
    if (error.message.includes('full')) return { success: false, error: 'This event is full.' };
    if (error.code === '23505') return { success: false, error: 'This email is already registered for the event.' };
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function setRegistrationStatus(
  registrationId: string,
  status: RegistrationStatus
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: DEMO_EDIT_ERROR };
  const { error } = await supabase
    .from('event_registrations')
    .update({ status, checked_in_at: status === 'attended' ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', registrationId);
  if (error) return { success: false, error: error.message.includes('full') ? 'This event is full.' : error.message };
  return { success: true };
}
