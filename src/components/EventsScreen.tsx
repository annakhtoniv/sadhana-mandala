import React, { useEffect, useMemo, useState } from 'react';
import { hasRole } from '../lib/roles';
import { useAuth } from '../context/AuthContext';
import { isoToZonedInput } from '../lib/dateUtils';
import { fetchCourses } from '../lib/batchService';
import {
  cancelMyRegistration,
  deleteEvent,
  fetchEvents,
  fetchMyRegistrations,
  fetchPlacesTaken,
  registerForEvent,
  saveEvent,
} from '../lib/eventService';
import { EVENT_KIND_LABEL, eventTiming, placesLeft, REGISTRATION_STATUS_LABEL, validateEventInput, type EventInput } from '../lib/eventUtils';
import type { Course, EventKind, OrgEvent, RegistrationStatus } from '../types/database';
import { EventManager } from './EventManager';
import { ArrowLeft, CalendarDays, EyeOff, Globe, MapPin, PlusCircle, Users } from 'lucide-react';

interface EventsScreenProps {
  onBack: () => void;
}

const inputClass =
  'w-full px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-500';
const labelClass = 'block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1';

export function formatEventDate(iso: string, timeZone: string, withTime = true): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function dayBlock(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short' }).formatToParts(new Date(iso));
  return {
    day: parts.find((p) => p.type === 'day')?.value || '',
    month: parts.find((p) => p.type === 'month')?.value || '',
  };
}

/**
 * Events (SPEC "Events"): everyone sees and registers for published events;
 * admins and teachers create events, manage registrations and attendance.
 */
export const EventsScreen: React.FC<EventsScreenProps> = ({ onBack }) => {
  const { organisation, user, profile, activeRole } = useAuth();
  // Staff tools only in the Teacher or Admin view (an admin previewing the Student view sees what students see)
  const isStaff = (hasRole(profile, 'admin') || hasRole(profile, 'teacher')) && activeRole !== 'student';
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [taken, setTaken] = useState<Map<string, number>>(new Map());
  const [mine, setMine] = useState<Map<string, RegistrationStatus>>(new Map());
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [managing, setManaging] = useState<OrgEvent | null>(null);
  const [editing, setEditing] = useState<EventInput | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!organisation.id) return;
    try {
      const list = await fetchEvents(organisation.id);
      const [placeMap, myMap] = await Promise.all([
        fetchPlacesTaken(list.map((e) => e.id)),
        profile?.id ? fetchMyRegistrations(profile.id) : Promise.resolve(new Map<string, RegistrationStatus>()),
      ]);
      setEvents(list);
      setTaken(placeMap);
      setMine(myMap);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load events');
    }
  };

  useEffect(() => {
    load();
    if (isStaff) fetchCourses(organisation.id).then(setCourses).catch(() => setCourses([]));
  }, [organisation.id, profile?.id]);

  const now = new Date();
  const coming = useMemo(() => events.filter((e) => eventTiming(e, now) !== 'past'), [events]);
  const past = useMemo(() => events.filter((e) => eventTiming(e, now) === 'past'), [events]);

  const register = async (e: OrgEvent) => {
    setBusyId(e.id);
    setMessage(null);
    const res = await registerForEvent(e.id);
    setBusyId(null);
    setMessage(res.success ? `You are registered for "${e.title}".` : res.message || 'Could not register.');
    await load();
  };

  const cancel = async (e: OrgEvent) => {
    setBusyId(e.id);
    setMessage(null);
    const res = await cancelMyRegistration(e.id);
    setBusyId(null);
    setMessage(res.success ? `Your place for "${e.title}" is cancelled.` : res.message || 'Could not cancel.');
    await load();
  };

  const openNew = () => {
    setFormErrors([]);
    setEditing({
      kind: 'intro_talk', title: '', description: '', starts_at: '', ends_at: '', venue: '', online_url: '',
      capacity: null, course_id: null, published: true,
    });
  };

  const openEdit = (e: OrgEvent) => {
    setFormErrors([]);
    setEditing({
      id: e.id, kind: e.kind, title: e.title, description: e.description || '',
      starts_at: isoToZonedInput(e.starts_at, organisation.timezone),
      ends_at: isoToZonedInput(e.ends_at, organisation.timezone), venue: e.venue || '', online_url: e.online_url || '', capacity: e.capacity,
      course_id: e.course_id, published: e.published,
    });
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editing || !user) return;
    const errors = validateEventInput(editing);
    setFormErrors(errors);
    if (errors.length) return;
    setSaving(true);
    const res = await saveEvent(organisation.id, user.id, editing, organisation.timezone);
    setSaving(false);
    if (!res.success) {
      setFormErrors([res.error || 'Could not save.']);
      return;
    }
    const wasEditingManaged = managing && editing.id === managing.id;
    setEditing(null);
    await load();
    if (wasEditingManaged) {
      const refreshed = (await fetchEvents(organisation.id)).find((e) => e.id === managing!.id);
      setManaging(refreshed || null);
    }
  };

  const handleDelete = async (e: OrgEvent) => {
    if (!window.confirm(`Delete "${e.title}" and all its registrations?`)) return;
    const res = await deleteEvent(e.id);
    setMessage(res.success ? `Deleted "${e.title}".` : `Could not delete: ${res.error}`);
    setManaging(null);
    await load();
  };

  const update = (patch: Partial<EventInput>) => setEditing((prev) => (prev ? { ...prev, ...patch } : prev));

  const eventCard = (e: OrgEvent) => {
    const timing = eventTiming(e, now);
    const left = placesLeft(e.capacity, taken.get(e.id) || 0);
    const status = mine.get(e.id);
    const holding = status === 'registered' || status === 'attended';
    const { day, month } = dayBlock(e.starts_at, organisation.timezone);
    return (
      <div key={e.id} className={`bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3 ${timing === 'past' ? 'opacity-70' : ''}`}>
        <div className="flex gap-3">
          <div className="w-12 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-center py-1.5">
            <div className="text-lg font-bold leading-none text-emerald-700 dark:text-emerald-300">{day}</div>
            <div className="text-[10px] uppercase text-emerald-700 dark:text-emerald-400">{month}</div>
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-semibold uppercase tracking-wide text-stone-500">
              <span>{EVENT_KIND_LABEL[e.kind]}</span>
              {timing === 'ongoing' && <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white normal-case tracking-normal">Happening now</span>}
              {!e.published && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 normal-case tracking-normal">
                  <EyeOff className="w-3 h-3" /> Draft
                </span>
              )}
            </div>
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">{e.title}</div>
            <div className="text-xs text-stone-500">{formatEventDate(e.starts_at, organisation.timezone)}</div>
            {e.venue && (
              <div className="inline-flex items-center gap-1 text-xs text-stone-500 mr-3"><MapPin className="w-3 h-3" />{e.venue}</div>
            )}
            {e.online_url && (
              <div className="inline-flex items-center gap-1 text-xs text-stone-500">
                <Globe className="w-3 h-3" />
                {holding ? (
                  <a href={e.online_url} target="_blank" rel="noopener noreferrer" className="underline text-emerald-700 dark:text-emerald-400">Join online</a>
                ) : (
                  'Online'
                )}
              </div>
            )}
          </div>
        </div>
        {e.description && <p className="text-xs text-stone-600 dark:text-stone-400">{e.description}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-stone-500">
            <Users className="w-3.5 h-3.5" />
            {left === null ? `${taken.get(e.id) || 0} registered` : left === 0 ? 'Full' : `${left} place${left === 1 ? '' : 's'} left`}
          </span>
          <div className="flex items-center gap-2">
            {status && status !== 'registered' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                {REGISTRATION_STATUS_LABEL[status]}
              </span>
            )}
            {isStaff && (
              <button type="button" onClick={() => setManaging(e)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer">
                Manage
              </button>
            )}
            {timing !== 'past' && e.published && (
              status === 'registered' ? (
                <button type="button" disabled={busyId === e.id} onClick={() => cancel(e)}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 disabled:opacity-50 cursor-pointer">
                  Cancel my place
                </button>
              ) : status !== 'attended' && left !== 0 ? (
                <button type="button" disabled={busyId === e.id} onClick={() => register(e)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer">
                  {busyId === e.id ? 'Registering...' : 'Register'}
                </button>
              ) : null
            )}
          </div>
        </div>
        {status === 'registered' && timing !== 'past' && (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">You are registered. At the event, scan the check-in QR code.</p>
        )}
      </div>
    );
  };

  if (managing) {
    return (
      <EventManager
        event={managing}
        timeZone={organisation.timezone}
        onBack={() => {
          setManaging(null);
          load();
        }}
        onEdit={() => openEdit(managing)}
        onDelete={() => handleDelete(managing)}
        editForm={editing ? renderForm() : null}
      />
    );
  }

  function renderForm() {
    if (!editing) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/70 backdrop-blur-sm">
        <form onSubmit={handleSave}
          className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{editing.id ? 'Edit event' : 'New event'}</h2>
          <div>
            <label className={labelClass} htmlFor="ev-kind">Kind</label>
            <select id="ev-kind" className={inputClass} value={editing.kind} onChange={(e) => update({ kind: e.target.value as EventKind })}>
              {(Object.keys(EVENT_KIND_LABEL) as EventKind[]).map((k) => <option key={k} value={k}>{EVENT_KIND_LABEL[k]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="ev-title">Title</label>
            <input id="ev-title" className={inputClass} value={editing.title} onChange={(e) => update({ title: e.target.value })}
              placeholder="e.g. Introduction to the Happiness Program" />
          </div>
          <div>
            <label className={labelClass} htmlFor="ev-desc">Description</label>
            <textarea id="ev-desc" rows={2} className={inputClass} value={editing.description} onChange={(e) => update({ description: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelClass} htmlFor="ev-start">Starts ({organisation.timezone} time)</label>
              <input id="ev-start" type="datetime-local" className={inputClass} value={editing.starts_at} onChange={(e) => update({ starts_at: e.target.value })} />
            </div>
            <div>
              <label className={labelClass} htmlFor="ev-end">Ends (optional)</label>
              <input id="ev-end" type="datetime-local" className={inputClass} value={editing.ends_at} onChange={(e) => update({ ends_at: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="ev-venue">Venue</label>
            <input id="ev-venue" className={inputClass} value={editing.venue} onChange={(e) => update({ venue: e.target.value })} placeholder="e.g. Community centre, room 2" />
          </div>
          <div>
            <label className={labelClass} htmlFor="ev-url">Online link (optional)</label>
            <input id="ev-url" type="url" className={inputClass} value={editing.online_url} onChange={(e) => update({ online_url: e.target.value })} placeholder="https://..." />
            <p className="text-[10px] text-stone-400 mt-1">Only people who registered see the link.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="ev-cap">Capacity</label>
              <input id="ev-cap" type="number" min={1} className={inputClass} value={editing.capacity ?? ''} placeholder="No limit"
                onChange={(e) => update({ capacity: e.target.value === '' ? null : Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelClass} htmlFor="ev-course">Programme (optional)</label>
              <select id="ev-course" className={inputClass} value={editing.course_id || ''} onChange={(e) => update({ course_id: e.target.value || null })}>
                <option value="">None</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={editing.published} onChange={(e) => update({ published: e.target.checked })} />
            <span>Published (members can see it and register)</span>
          </label>
          {formErrors.length > 0 && (
            <ul className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
              {formErrors.map((err) => <li key={err}>{err}</li>)}
            </ul>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditing(null)}
              className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save event'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-150">
      <button type="button" onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back</span>
      </button>

      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CalendarDays className="w-4 h-4" />
          <span>Events</span>
        </div>
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">Coming up ({coming.length})</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400">Intro talks, satsangs, programmes and follow-up sessions. Times are in {organisation.timezone}.</p>
        {isStaff && (
          <button type="button" onClick={openNew}
            className="w-full mt-2 py-3 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer">
            <PlusCircle className="w-4 h-4" />
            <span>New event</span>
          </button>
        )}
      </div>

      {message && <div role="status" className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs text-stone-700 dark:text-stone-300">{message}</div>}
      {loadError && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 text-xs text-red-700 dark:text-red-300">Could not load events: {loadError}</div>}

      {coming.length === 0 && !loadError && <p className="text-xs text-stone-400 italic text-center">No events coming up.</p>}
      {coming.map(eventCard)}

      {past.length > 0 && (
        <div className="space-y-3">
          <button type="button" onClick={() => setShowPast((v) => !v)} className="text-xs text-stone-500 hover:underline cursor-pointer">
            {showPast ? 'Hide past events' : `Show past events (${past.length})`}
          </button>
          {showPast && past.map(eventCard)}
        </div>
      )}

      {renderForm()}
    </div>
  );
};
