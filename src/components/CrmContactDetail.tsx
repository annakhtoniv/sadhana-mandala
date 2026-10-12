import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  addActivity,
  deleteContact,
  fetchActivities,
  inviteContactToEvent,
  registerContactForBatch,
  setContactStage,
  type OpenBatch,
} from '../lib/crmService';
import {
  ACTIVITY_LABEL,
  ALL_STAGES,
  eventInviteMessage,
  looksInternational,
  mailtoUrl,
  programmeInviteMessage,
  SOURCE_LABEL,
  STAGE_CLASS,
  STAGE_HINT,
  STAGE_LABEL,
  telUrl,
  whatsappUrl,
} from '../lib/crmUtils';
import { batchJoinUrl } from '../lib/joinLink';
import { formatDateDisplay } from '../lib/dateUtils';
import { formatEventDate } from './EventsScreen';
import type { CrmActivity, CrmActivityKind, CrmContact, CrmStage, OrgEvent } from '../types/database';
import { AlertTriangle, ArrowLeft, CalendarPlus, GraduationCap, Mail, MessageCircle, Pencil, Phone, Send, Trash2, UserCheck } from 'lucide-react';

interface CrmContactDetailProps {
  contact: CrmContact;
  ownerName: string | null;
  courseName: string | null;
  events: OrgEvent[];
  batches: OpenBatch[];
  onBack: () => void;
  onEdit: () => void;
  /** Reload the list after a change */
  onChanged: () => Promise<void>;
}

const inputClass =
  'w-full px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-500';
const card = 'bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3';
const actionClass =
  'flex-1 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center gap-1.5 cursor-pointer';

type Draft = { subject: string; text: string } | null;

/** One lead: contact buttons, stage, invite to an event, register for a programme, notes. */
export const CrmContactDetail: React.FC<CrmContactDetailProps> = ({
  contact,
  ownerName,
  courseName,
  events,
  batches,
  onBack,
  onEdit,
  onChanged,
}) => {
  const { organisation, user, profile } = useAuth();
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [eventId, setEventId] = useState(events[0]?.id || '');
  const [batchId, setBatchId] = useState(batches[0]?.id || '');
  const [draft, setDraft] = useState<Draft>(null);
  const [noteKind, setNoteKind] = useState<Exclude<CrmActivityKind, 'stage'>>('call');
  const [noteText, setNoteText] = useState('');
  const senderName = profile?.full_name || '';
  const canMessage = !contact.opted_out;

  const loadActivities = async () => {
    try {
      setActivities(await fetchActivities(contact.id));
    } catch (err) {
      setMessage({ tone: 'error', text: `Could not load the history: ${err instanceof Error ? err.message : 'unknown error'}` });
    }
  };

  useEffect(() => {
    loadActivities();
  }, [contact.id]);

  useEffect(() => {
    if (!eventId && events[0]) setEventId(events[0].id);
    if (!batchId && batches[0]) setBatchId(batches[0].id);
  }, [events, batches]);

  const log = async (kind: Exclude<CrmActivityKind, 'stage'>, body: string) => {
    if (!user) return;
    await addActivity(organisation.id, user.id, contact.id, kind, body);
    await loadActivities();
  };

  const changeStage = async (stage: CrmStage) => {
    if (!user || stage === contact.stage) return;
    setBusy(true);
    setMessage(null);
    const res = await setContactStage(organisation.id, user.id, contact, stage);
    setBusy(false);
    if (!res.success) {
      setMessage({ tone: 'error', text: res.error || 'Could not change the stage.' });
      return;
    }
    await onChanged();
    await loadActivities();
  };

  const inviteToEvent = async () => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    setBusy(true);
    setMessage(null);
    const res = await inviteContactToEvent(contact.id, event.id);
    setBusy(false);
    if (!res.success) {
      setMessage({ tone: 'error', text: res.message || 'Could not register them.' });
      return;
    }
    setMessage({ tone: 'ok', text: `${contact.full_name} is registered for "${event.title}". Send them the invitation below.` });
    setDraft({
      subject: event.title,
      text: eventInviteMessage({
        contactName: contact.full_name,
        senderName,
        eventTitle: event.title,
        when: formatEventDate(event.starts_at, organisation.timezone),
        venue: event.venue,
        onlineUrl: event.online_url,
      }),
    });
    await onChanged();
    await loadActivities();
  };

  const registerForBatch = async () => {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return;
    setBusy(true);
    setMessage(null);
    const res = await registerContactForBatch(contact.id, batch.id);
    setBusy(false);
    const text = programmeInviteMessage({
      contactName: contact.full_name,
      senderName,
      courseName: batch.course_name,
      batchName: batch.name,
      startDate: formatDateDisplay(batch.start_date, organisation.timezone),
      joinUrl: batchJoinUrl(batch.join_code, window.location.origin),
      appName: organisation.app_name,
    });
    if (!res.success) {
      setMessage({ tone: 'error', text: res.message || 'Could not register them.' });
      // Without an email they can still join themselves with the batch link
      if (res.join_code) setDraft({ subject: batch.course_name, text });
      return;
    }
    setMessage({
      tone: 'ok',
      text: res.enrolled
        ? `${contact.full_name} is enrolled in ${batch.name}.`
        : `${contact.full_name} is registered. They are enrolled automatically when they sign in with ${contact.email}. Send them the link below.`,
    });
    setDraft({ subject: batch.course_name, text });
    await onChanged();
    await loadActivities();
  };

  const saveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setBusy(true);
    await log(noteKind, noteText);
    setBusy(false);
    setNoteText('');
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${contact.full_name} and their history? This cannot be undone.`)) return;
    const res = await deleteContact(contact.id);
    if (!res.success) {
      setMessage({ tone: 'error', text: res.error || 'Could not delete.' });
      return;
    }
    await onChanged();
    onBack();
  };

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-150">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Leads</span>
      </button>

      <div className={card}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${STAGE_CLASS[contact.stage]}`}>
              {STAGE_LABEL[contact.stage]}
            </span>
            <h1 className="text-lg font-semibold text-stone-900 dark:text-stone-100">{contact.full_name}</h1>
            <div className="text-xs text-stone-500 space-y-0.5">
              <div>
                {SOURCE_LABEL[contact.source]}
                {courseName ? ` · interested in ${courseName}` : ''}
              </div>
              {ownerName && <div>Owner: {ownerName}</div>}
              {contact.next_action_on && <div>Next follow-up: {formatDateDisplay(contact.next_action_on, organisation.timezone)}</div>}
            </div>
            {contact.profile_id && (
              <div className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                <UserCheck className="w-3.5 h-3.5" /> Has signed up in the app
              </div>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button type="button" onClick={onEdit} aria-label="Edit lead" className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer">
              <Pencil className="w-4 h-4" />
            </button>
            <button type="button" onClick={remove} aria-label="Delete lead" className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {contact.notes && <p className="text-xs text-stone-600 dark:text-stone-300 whitespace-pre-line">{contact.notes}</p>}

        {contact.opted_out ? (
          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-[11px] text-red-700 dark:text-red-300 flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Opted out: do not contact this person.</span>
          </div>
        ) : !contact.consent_at ? (
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-[11px] text-amber-800 dark:text-amber-300 flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Consent not recorded. Ask if they are happy to hear from us, then tick it in Edit.</span>
          </div>
        ) : null}

        <div className="flex gap-2">
          {contact.phone && canMessage && (
            <>
              <a href={telUrl(contact.phone)} onClick={() => log('call', 'Called')} className={actionClass}>
                <Phone className="w-3.5 h-3.5" /> Call
              </a>
              <a
                href={whatsappUrl(contact.phone, `Hi ${contact.full_name.split(' ')[0]},`)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => log('whatsapp', 'Opened WhatsApp')}
                className={actionClass}
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            </>
          )}
          {contact.email && canMessage && (
            <a href={mailtoUrl(contact.email, organisation.app_name, '')} onClick={() => log('email', 'Opened email')} className={actionClass}>
              <Mail className="w-3.5 h-3.5" /> Email
            </a>
          )}
        </div>
        <div className="text-[11px] text-stone-500 break-all">
          {[contact.phone, contact.email].filter(Boolean).join(' · ')}
          {contact.phone && !looksInternational(contact.phone) && (
            <span className="block text-amber-700 dark:text-amber-400">
              Add the country code (e.g. +971) to the phone number so WhatsApp opens the right chat.
            </span>
          )}
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`p-3 rounded-xl text-xs ${message.tone === 'ok' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'}`}
        >
          {message.text}
        </div>
      )}

      {draft && (
        <div className={card}>
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Message to send</h2>
          <p className="text-[11px] text-stone-500">Edit it if you like, then send it from your own WhatsApp or email.</p>
          <textarea className={`${inputClass} min-h-[150px]`} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          {canMessage ? (
            <div className="flex gap-2">
              <a
                href={whatsappUrl(contact.phone, draft.text)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => log('whatsapp', `Sent the invitation on WhatsApp (${draft.subject})`)}
                className={`${actionClass} bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700`}
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
              {contact.email && (
                <a
                  href={mailtoUrl(contact.email, draft.subject, draft.text)}
                  onClick={() => log('email', `Emailed: ${draft.subject}`)}
                  className={actionClass}
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </a>
              )}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(draft.text);
                    setMessage({ tone: 'ok', text: 'Message copied.' });
                  } catch {
                    // ignore
                  }
                }}
                className={actionClass}
              >
                Copy
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-red-600">This person opted out. Do not send messages.</p>
          )}
        </div>
      )}

      <div className={card}>
        <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Stage</h2>
        <div className="flex flex-wrap gap-1.5">
          {ALL_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => changeStage(s)}
              title={STAGE_HINT[s]}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer disabled:opacity-50 ${
                s === contact.stage ? `${STAGE_CLASS[s]} border-transparent ring-2 ring-stone-400` : 'border-stone-200 dark:border-stone-700 text-stone-500'
              }`}
            >
              {STAGE_LABEL[s]}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-stone-500">
          {STAGE_HINT[contact.stage]}. The stage also moves by itself when they attend an event or enrol in a programme.
        </p>
      </div>

      <div className={card}>
        <div className="flex items-center gap-2">
          <CalendarPlus className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Invite to an event</h2>
        </div>
        {events.length === 0 ? (
          <p className="text-xs text-stone-500">No upcoming events. A teacher can add an intro talk under Events.</p>
        ) : (
          <>
            <select aria-label="Event" className={inputClass} value={eventId} onChange={(e) => setEventId(e.target.value)}>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {formatEventDate(e.starts_at, organisation.timezone)}: {e.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !eventId || contact.opted_out}
              onClick={inviteToEvent}
              className="w-full py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Register and write the invitation
            </button>
            <p className="text-[11px] text-stone-500">They are added to the event's guest list, and the host can tick them off at the door.</p>
          </>
        )}
      </div>

      <div className={card}>
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Register for a programme</h2>
        </div>
        {batches.length === 0 ? (
          <p className="text-xs text-stone-500">No batch starting soon. A teacher or admin creates batches.</p>
        ) : (
          <>
            <select aria-label="Batch" className={inputClass} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.course_name}: {b.name} (starts {formatDateDisplay(b.start_date, organisation.timezone)})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !batchId || contact.opted_out}
              onClick={registerForBatch}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <GraduationCap className="w-3.5 h-3.5" /> Register and write the message
            </button>
            <p className="text-[11px] text-stone-500">
              The message includes the batch link. When they open it and sign in with Google, they are in the batch.
            </p>
          </>
        )}
      </div>

      <div className={card}>
        <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">History</h2>
        <form onSubmit={saveNote} className="space-y-2">
          <div className="flex gap-2">
            <select
              aria-label="Kind of note"
              className={`${inputClass} w-auto`}
              value={noteKind}
              onChange={(e) => setNoteKind(e.target.value as Exclude<CrmActivityKind, 'stage'>)}
            >
              {(['call', 'note', 'whatsapp', 'email', 'meeting'] as const).map((k) => (
                <option key={k} value={k}>
                  {ACTIVITY_LABEL[k]}
                </option>
              ))}
            </select>
            <input className={inputClass} placeholder="What happened?" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          </div>
          <button type="submit" disabled={busy || !noteText.trim()} className="w-full py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-medium disabled:opacity-50 cursor-pointer">
            Add to history
          </button>
        </form>
        {activities.length === 0 && <p className="text-xs text-stone-400 italic">Nothing yet.</p>}
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {activities.map((a) => (
            <li key={a.id} className="py-2 text-xs">
              <div className="flex justify-between gap-2 text-[10px] uppercase font-semibold text-stone-500">
                <span>{ACTIVITY_LABEL[a.kind]}</span>
                <span>{formatEventDate(a.created_at, organisation.timezone)}</span>
              </div>
              <div className="text-stone-800 dark:text-stone-200 whitespace-pre-line">{a.body}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
