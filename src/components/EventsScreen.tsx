import React, { useEffect, useMemo, useState } from 'react';
import { currentLocale } from '../i18n/locale';
import { hasRole } from '../lib/roles';
import { useAuth } from '../context/AuthContext';
import { Sheet, useConfirm } from './Sheet';
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
import { EVENT_KIND_LABEL, eventTiming, placesLeft, validateEventInput, type EventInput } from '../lib/eventUtils';
import type { Course, EventKind, OrgEvent, RegistrationStatus } from '../types/database';
import { EventManager } from './EventManager';
import { CalendarDays, EyeOff, Globe, MapPin, PlusCircle, Users } from 'lucide-react';
import { useT, type MsgKey } from '../i18n';

const inputClass = 'ui-input';
const labelClass = 'ui-label';

export function formatEventDate(iso: string, timeZone: string, withTime = true): string {
  try {
    return new Intl.DateTimeFormat(currentLocale(), {
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
  const parts = new Intl.DateTimeFormat(currentLocale(), { timeZone, day: 'numeric', month: 'short' }).formatToParts(new Date(iso));
  return {
    day: parts.find((p) => p.type === 'day')?.value || '',
    month: parts.find((p) => p.type === 'month')?.value || '',
  };
}

/**
 * Events (SPEC "Events"): everyone sees and registers for published events;
 * admins and teachers create events, manage registrations and attendance.
 */
export const EventsScreen: React.FC = () => {
  const { organisation, user, profile, activeRole } = useAuth();
  const confirm = useConfirm();
  const t = useT();
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
      setLoadError(err instanceof Error ? err.message : t('events.loadFailed'));
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
    setMessage(res.success ? t('events.registered', { title: e.title }) : res.message || t('events.registerFailed'));
    await load();
  };

  const cancel = async (e: OrgEvent) => {
    setBusyId(e.id);
    setMessage(null);
    const res = await cancelMyRegistration(e.id);
    setBusyId(null);
    setMessage(res.success ? t('events.cancelled', { title: e.title }) : res.message || t('events.cancelFailed'));
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
    if (!(await confirm({ title: `Delete "${e.title}"?`, message: 'All its registrations are deleted too.', confirmLabel: 'Delete', danger: true }))) return;
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
      <div key={e.id} className={`ui-card !p-4 space-y-3 ${timing === 'past' ? 'opacity-70' : ''}`}>
        <div className="flex gap-3">
          <div className="w-14 shrink-0 rounded-xl bg-emerald-50 text-center py-1.5">
            <div className="text-lg font-bold leading-none text-emerald-700">{day}</div>
            <div className="text-sm uppercase text-emerald-800">{month}</div>
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap text-xs font-semibold uppercase tracking-wide text-stone-600">
              <span>{t(`events.kind.${e.kind}` as MsgKey)}</span>
              {timing === 'ongoing' && <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white normal-case tracking-normal">{t('events.now')}</span>}
              {!e.published && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-stone-200 normal-case tracking-normal">
                  <EyeOff className="w-3 h-3" /> {t('events.draft')}
                </span>
              )}
            </div>
            <div className="text-base font-semibold text-stone-900 user-text">{e.title}</div>
            <div className="text-sm text-stone-700">{formatEventDate(e.starts_at, organisation.timezone)}</div>
            {e.venue && (
              <div className="inline-flex items-center gap-1 text-sm text-stone-600 me-3"><MapPin className="w-3.5 h-3.5" /><span className="user-text">{e.venue}</span></div>
            )}
            {e.online_url && (
              <div className="inline-flex items-center gap-1 text-sm text-stone-600">
                <Globe className="w-3.5 h-3.5" />
                {holding ? (
                  <a href={e.online_url} target="_blank" rel="noopener noreferrer" className="underline text-emerald-700">{t('followups.joinOnline')}</a>
                ) : (
                  t('events.online')
                )}
              </div>
            )}
          </div>
        </div>
        {e.description && <p className="text-sm text-stone-700 user-text">{e.description}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-sm text-stone-600">
            <Users className="w-4 h-4" />
            {left === null ? t('events.registeredCount', { n: taken.get(e.id) || 0 }) : left === 0 ? t('events.full') : left === 1 ? t('events.oneLeft') : t('events.placesLeft', { n: left })}
          </span>
          <div className="flex items-center gap-2">
            {status && status !== 'registered' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                {t(`events.status.${status}` as MsgKey)}
              </span>
            )}
            {isStaff && (
              <button type="button" onClick={() => setManaging(e)} className="ui-btn-ghost !min-h-10 !py-2 !px-4">
                {t('events.manage')}
              </button>
            )}
            {timing !== 'past' && e.published && (
              status === 'registered' ? (
                <button type="button" disabled={busyId === e.id} onClick={() => cancel(e)} className="ui-btn-ghost !min-h-10 !py-2 !px-4">
                  {t('events.cancelPlace')}
                </button>
              ) : status !== 'attended' && left !== 0 ? (
                <button type="button" disabled={busyId === e.id} onClick={() => register(e)} className="ui-btn-primary !min-h-10 !py-2 !px-4">
                  {busyId === e.id ? t('events.registering') : t('events.register')}
                </button>
              ) : null
            )}
          </div>
        </div>
        {status === 'registered' && timing !== 'past' && (
          <p className="text-sm text-emerald-800">{t('events.registeredHelp')}</p>
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
      <Sheet open onClose={() => setEditing(null)} title={editing.id ? 'Edit event' : 'New event'} busy={saving}>
        <form onSubmit={handleSave} className="space-y-4">
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
            <p className="text-xs text-stone-500 mt-1">Only people who registered see the link.</p>
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
          <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={editing.published} onChange={(e) => update({ published: e.target.checked })} />
            <span>Published (members can see it and register)</span>
          </label>
          {formErrors.length > 0 && (
            <ul role="alert" className="p-3 rounded-xl bg-red-50 text-sm text-red-700 space-y-1 list-disc list-inside">
              {formErrors.map((err) => <li key={err}>{err}</li>)}
            </ul>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditing(null)}
              className="ui-btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="ui-btn-primary">
              {saving ? 'Saving...' : 'Save event'}
            </button>
          </div>
        </form>
      </Sheet>
    );
  }

  return (
    <div className="w-full space-y-5 animate-fade-up">
      <section className="ui-card space-y-2">
        <span className="ui-eyebrow">
          <CalendarDays className="w-3.5 h-3.5" /> {t('nav.events')}
        </span>
        <h1 className="font-display text-2xl font-semibold text-stone-950 mt-2">{t('events.comingUp', { count: coming.length })}</h1>
        <p className="text-base text-stone-600">{t('events.subtitle', { tz: organisation.timezone })}</p>
        {isStaff && (
          <button type="button" onClick={openNew} className="ui-btn-primary w-full mt-2">
            <PlusCircle className="w-4 h-4" />
            <span>{t('events.new')}</span>
          </button>
        )}
      </section>

      {message && <div role="status" className="p-3 rounded-xl bg-emerald-50 text-sm text-emerald-900">{message}</div>}
      {loadError && <div role="alert" className="p-3 rounded-xl bg-red-50 text-sm text-red-700">{t('events.loadFailed')}: {loadError}</div>}

      {coming.length === 0 && !loadError && <p className="text-base text-stone-600 text-center">{t('events.none')}</p>}
      {coming.map(eventCard)}

      {past.length > 0 && (
        <div className="space-y-3">
          <button type="button" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast} className="ui-btn-ghost w-full">
            {showPast ? t('events.hidePast') : t('events.showPast', { count: past.length })}
          </button>
          {showPast && past.map(eventCard)}
        </div>
      )}

      {renderForm()}
    </div>
  );
};
