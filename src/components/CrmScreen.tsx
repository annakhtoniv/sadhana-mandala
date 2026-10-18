import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchContacts, fetchOpenBatches, fetchOwners, saveContact, type OpenBatch } from '../lib/crmService';
import { fetchCourses } from '../lib/batchService';
import { fetchEvents } from '../lib/eventService';
import { eventTiming } from '../lib/eventUtils';
import { getTodayInTimezone } from '../lib/dateUtils';
import { isStaffRole, ROLE_LABEL } from '../lib/roles';
import {
  filterContacts,
  isFollowUpDue,
  PIPELINE,
  pipelineCounts,
  SOURCE_LABEL,
  STAGE_CLASS,
  STAGE_LABEL,
  validateContactInput,
  type ContactFilter,
  type ContactInput,
} from '../lib/crmUtils';
import type { Course, CrmContact, CrmOwner, CrmSource, OrgEvent } from '../types/database';
import { CrmContactDetail } from './CrmContactDetail';
import { FunnelReportPanel } from './FunnelReportPanel';
import { AlertTriangle, ArrowLeft, BarChart3, Clock, Contact, PlusCircle, Search, UserCheck } from 'lucide-react';

const inputClass = 'ui-input';
const labelClass = 'ui-label';
const card = 'ui-card';

type View = { kind: 'list' } | { kind: 'detail'; id: string } | { kind: 'form'; id: string | null } | { kind: 'reports' };

function emptyInput(userId: string, courseId: string | null): ContactInput {
  return {
    full_name: '',
    email: '',
    phone: '',
    source: 'friend',
    interest_course_id: courseId,
    owner_id: userId,
    consent: false,
    opted_out: false,
    next_action_on: '',
    notes: '',
  };
}

function toInput(c: CrmContact): ContactInput {
  return {
    full_name: c.full_name,
    email: c.email || '',
    phone: c.phone || '',
    source: c.source,
    interest_course_id: c.interest_course_id,
    owner_id: c.owner_id,
    consent: Boolean(c.consent_at),
    opted_out: c.opted_out,
    next_action_on: c.next_action_on || '',
    notes: c.notes || '',
  };
}

/**
 * Leads (SPEC "CRM for volunteers"): volunteers manage their own leads;
 * admins and teachers see every lead, assign owners and see the funnel.
 */
export const CrmScreen: React.FC = () => {
  const { organisation, user, profile } = useAuth();
  const isStaff = isStaffRole(profile?.role);
  const today = getTodayInTimezone(organisation.timezone);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [owners, setOwners] = useState<CrmOwner[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [batches, setBatches] = useState<OpenBatch[]>([]);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [filter, setFilter] = useState<ContactFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ContactInput | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadContacts = async () => {
    try {
      setContacts(await fetchContacts(organisation.id));
      setError(null);
    } catch (err) {
      setError(`Could not load leads: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadContacts();
      // The rest is optional: the list still works if one of these fails
      const [ownerList, courseList, eventList, batchList] = await Promise.all([
        fetchOwners().catch(() => [] as CrmOwner[]),
        fetchCourses(organisation.id).catch(() => [] as Course[]),
        fetchEvents(organisation.id).catch(() => [] as OrgEvent[]),
        fetchOpenBatches().catch(() => [] as OpenBatch[]),
      ]);
      if (cancelled) return;
      setOwners(ownerList);
      setCourses(courseList.filter((c) => c.is_active !== false));
      setEvents(eventList.filter((e) => e.published && eventTiming(e) !== 'past'));
      setBatches(batchList);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [organisation.id]);

  const ownerName = (id: string | null) => {
    if (!id) return null;
    const o = owners.find((x) => x.id === id);
    return o ? o.full_name || o.email : id === user?.id ? profile?.full_name || 'You' : 'Someone else';
  };
  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.name || null;
  const counts = useMemo(() => pipelineCounts(contacts), [contacts]);
  const dueCount = contacts.filter((c) => isFollowUpDue(c, today)).length;
  const visible = filterContacts(contacts, filter, search, today);
  const defaultCourse = courses.find((c) => c.has_practice_track)?.id || courses[0]?.id || null;

  const openForm = (contact: CrmContact | null) => {
    if (!user) return;
    setForm(contact ? toInput(contact) : emptyInput(user.id, defaultCourse));
    setFormErrors([]);
    setView({ kind: 'form', id: contact?.id || null });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !user || view.kind !== 'form') return;
    const errors = validateContactInput(form);
    setFormErrors(errors);
    if (errors.length) return;
    setSaving(true);
    const existing = view.id ? contacts.find((c) => c.id === view.id) || null : null;
    const res = await saveContact(organisation.id, user.id, form, existing);
    setSaving(false);
    if (!res.success) {
      setFormErrors([res.error || 'Could not save.']);
      return;
    }
    await loadContacts();
    setView(res.contact ? { kind: 'detail', id: res.contact.id } : { kind: 'list' });
  };

  if (view.kind === 'reports') {
    return (
      <div className="w-full space-y-4 animate-in fade-in duration-150">
        <button type="button" onClick={() => setView({ kind: 'list' })} className="ui-btn-ghost !min-h-10 !py-2 !px-4">
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          <span>Back to Leads</span>
        </button>
        <FunnelReportPanel />
      </div>
    );
  }

  if (view.kind === 'detail') {
    const contact = contacts.find((c) => c.id === view.id);
    if (contact) {
      return (
        <CrmContactDetail
          contact={contact}
          ownerName={isStaff ? ownerName(contact.owner_id) || 'Unassigned' : null}
          courseName={courseName(contact.interest_course_id)}
          events={events}
          batches={batches}
          onBack={() => setView({ kind: 'list' })}
          onEdit={() => openForm(contact)}
          onChanged={loadContacts}
        />
      );
    }
  }

  if (view.kind === 'form' && form) {
    const set = <K extends keyof ContactInput>(key: K, value: ContactInput[K]) => setForm({ ...form, [key]: value });
    return (
      <div className="w-full space-y-4 animate-in fade-in duration-150">
        <button
          type="button"
          onClick={() => setView(view.id ? { kind: 'detail', id: view.id } : { kind: 'list' })}
          className="ui-btn-ghost !min-h-10 !py-2 !px-4"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          <span>Cancel</span>
        </button>
        <form onSubmit={submit} className={`${card} space-y-3`}>
          <h1 className="text-base font-semibold text-stone-900">{view.id ? 'Edit lead' : 'Add a lead'}</h1>
          <div>
            <label className={labelClass} htmlFor="lead-name">Name</label>
            <input id="lead-name" className={inputClass} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="lead-phone">Phone (with country code, e.g. +971 50 123 4567)</label>
            <input id="lead-phone" type="tel" className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="lead-email">Email</label>
            <input id="lead-email" type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} />
            <p className="text-xs text-stone-500 mt-1">With an email, they can be registered for a batch before they sign up.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass} htmlFor="lead-source">How we met</label>
              <select id="lead-source" className={inputClass} value={form.source} onChange={(e) => set('source', e.target.value as CrmSource)}>
                {(Object.keys(SOURCE_LABEL) as CrmSource[]).map((s) => (
                  <option key={s} value={s}>{SOURCE_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="lead-next">Next follow-up</label>
              <input id="lead-next" type="date" className={inputClass} value={form.next_action_on} onChange={(e) => set('next_action_on', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="lead-course">Interested in</label>
            <select
              id="lead-course"
              className={inputClass}
              value={form.interest_course_id || ''}
              onChange={(e) => set('interest_course_id', e.target.value || null)}
            >
              <option value="">Not sure yet</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {isStaff && (
            <div>
              <label className={labelClass} htmlFor="lead-owner">Owner</label>
              <select id="lead-owner" className={inputClass} value={form.owner_id || ''} onChange={(e) => set('owner_id', e.target.value || null)}>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.full_name || o.email} ({ROLE_LABEL[o.role]})
                  </option>
                ))}
              </select>
              <p className="text-xs text-stone-500 mt-1">A volunteer sees only the leads they own.</p>
            </div>
          )}
          <div>
            <label className={labelClass} htmlFor="lead-notes">Notes</label>
            <textarea id="lead-notes" className={`${inputClass} min-h-[70px]`} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <label className="flex items-start gap-2 text-xs text-stone-700">
            <input type="checkbox" className="mt-0.5" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} />
            <span>They agreed that we contact them about our programmes and events.</span>
          </label>
          <label className="flex items-start gap-2 text-xs text-stone-700">
            <input type="checkbox" className="mt-0.5" checked={form.opted_out} onChange={(e) => set('opted_out', e.target.checked)} />
            <span>Do not contact (they asked us to stop).</span>
          </label>
          {formErrors.length > 0 && (
            <ul role="alert" className="p-3 rounded-xl bg-red-50 text-xs text-red-600 list-disc list-inside">
              {formErrors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-stone-900 text-stone-100 text-sm font-semibold disabled:opacity-50 cursor-pointer">
            {saving ? 'Saving...' : 'Save lead'}
          </button>
        </form>
      </div>
    );
  }

  const chip = (value: ContactFilter, label: string, count: number) => (
    <button
      key={value}
      type="button"
      onClick={() => setFilter(value)}
      aria-pressed={filter === value}
      className={`shrink-0 min-h-10 px-3.5 rounded-full text-sm font-semibold cursor-pointer ring-1 ${
        filter === value ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white ring-stone-300 text-stone-700'
      }`}
    >
      {label} {count}
    </button>
  );

  return (
    <div className="w-full space-y-4 animate-fade-up">
      <section className="ui-card space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-stone-950 flex items-center gap-2">
              <Contact className="w-6 h-6 text-emerald-700" /> Leads
            </h1>
            <p className="text-base text-stone-600 mt-1">
              {isStaff
                ? 'Everyone volunteers have met, from first contact to the programme.'
                : 'People you have met. Invite them to an intro talk and help them register.'}
            </p>
          </div>
          {isStaff && (
            <button
              type="button"
              onClick={() => setView({ kind: 'reports' })}
              className="ui-btn-ghost shrink-0 !px-4"
            >
              <BarChart3 className="w-4 h-4" /> Reports
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => openForm(null)}
          className="ui-btn-primary w-full"
        >
          <PlusCircle className="w-4 h-4" /> Add a lead
        </button>
      </section>

      {/* Filters scroll sideways; the fade shows there are more */}
      <div className="relative">
      <div role="group" aria-label="Show" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 pe-8">
        {chip('all', 'All', contacts.length)}
        {chip('due', 'Follow up', dueCount)}
        {PIPELINE.map((s) => chip(s, STAGE_LABEL[s], counts[s]))}
        {chip('lost', STAGE_LABEL.lost, counts.lost)}
      </div>
      <div className="pointer-events-none absolute inset-y-0 end-0 w-8 bg-gradient-to-l rtl:bg-gradient-to-r from-[#f7f7f8] to-transparent" aria-hidden="true" />
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-stone-500 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          aria-label="Search leads"
          placeholder="Search by name, phone or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} ps-9`}
        />
      </div>

      {error && <div role="alert" className="p-3 rounded-xl bg-red-50 text-sm text-red-700">{error}</div>}
      {loading && <p role="status" className="text-sm text-stone-600">Loading leads...</p>}
      {!loading && visible.length === 0 && !error && (
        <div className="ui-card text-center text-base text-stone-600">
          {contacts.length === 0 ? 'No leads yet. Add the first person you have met.' : 'No leads match.'}
        </div>
      )}

      <ul className="space-y-2">
        {visible.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setView({ kind: 'detail', id: c.id })}
              className="ui-card !p-4 w-full text-start hover:bg-stone-50 cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span dir="auto" className="font-semibold text-base text-stone-900 truncate user-text">{c.full_name}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${STAGE_CLASS[c.stage]}`}>{STAGE_LABEL[c.stage]}</span>
              </div>
              <div className="text-sm text-stone-600 truncate">{[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact details'}</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-stone-600">
                {isFollowUpDue(c, today) && (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                    <Clock className="w-3 h-3" /> Follow up due
                  </span>
                )}
                {c.profile_id && (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <UserCheck className="w-3 h-3" /> In the app
                  </span>
                )}
                {c.opted_out ? (
                  <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="w-3 h-3" /> Do not contact</span>
                ) : !c.consent_at ? (
                  <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle className="w-3 h-3" /> No consent yet</span>
                ) : null}
                {isStaff && <span>Owner: {ownerName(c.owner_id) || 'Unassigned'}</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
