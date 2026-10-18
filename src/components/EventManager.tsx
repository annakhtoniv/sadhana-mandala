import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { addGuest, fetchCheckinCode, fetchEventRegistrations, setRegistrationStatus } from '../lib/eventService';
import { attendanceSummary, attendeeName, EVENT_KIND_LABEL, placesLeft, REGISTRATION_STATUS_LABEL } from '../lib/eventUtils';
import type { EventRegistration, OrgEvent, RegistrationStatus } from '../types/database';
import { formatEventDate } from './EventsScreen';
import { ArrowLeft, Pencil, QrCode, Trash2, UserPlus } from 'lucide-react';

interface EventManagerProps {
  event: OrgEvent;
  timeZone: string;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** The edit form, rendered by the events screen when open */
  editForm: React.ReactNode;
}

const STATUS_CLASS: Record<RegistrationStatus, string> = {
  registered: 'bg-indigo-100 text-indigo-700',
  attended: 'bg-emerald-100 text-emerald-700',
  no_show: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-stone-100 text-stone-500',
};

const inputClass = 'ui-input';

/** Staff view of one event: attendance, check-in QR, registrations and guests. */
export const EventManager: React.FC<EventManagerProps> = ({ event, timeZone, onBack, onEdit, onDelete, editForm }) => {
  const { organisation, user } = useAuth();
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [guest, setGuest] = useState({ name: '', email: '', phone: '' });
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setRegistrations(await fetchEventRegistrations(event.id));
    } catch (err) {
      setMessage(`Could not load registrations: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  useEffect(() => {
    load();
    fetchCheckinCode(event.id).then(setCode).catch(() => setCode(null));
  }, [event.id]);

  const summary = attendanceSummary(registrations);
  const left = placesLeft(event.capacity, summary.taken);
  const checkinUrl = code ? `${window.location.origin}/?event=${encodeURIComponent(code)}` : '';

  const changeStatus = async (r: EventRegistration, status: RegistrationStatus) => {
    setBusy(true);
    setMessage(null);
    const res = await setRegistrationStatus(r.id, status);
    setBusy(false);
    if (!res.success) setMessage(res.error || 'Could not update.');
    await load();
  };

  const submitGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!guest.name.trim()) {
      setMessage('Please enter the guest\'s name.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await addGuest(organisation.id, user.id, event.id, guest);
    setBusy(false);
    if (!res.success) {
      setMessage(res.error || 'Could not add the guest.');
      return;
    }
    setGuest({ name: '', email: '', phone: '' });
    setShowGuestForm(false);
    setMessage(`Added ${guest.name.trim()}.`);
    await load();
  };

  const order: RegistrationStatus[] = ['registered', 'attended', 'no_show', 'cancelled'];
  const sorted = [...registrations].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-150">
      <button type="button" onClick={onBack}
        className="ui-btn-ghost !min-h-10 !py-2 !px-4">
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        <span>Back to Events</span>
      </button>

      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              {EVENT_KIND_LABEL[event.kind]}{event.published ? '' : ' · Draft'}
            </div>
            <h1 className="text-lg font-semibold text-stone-900">{event.title}</h1>
            <div className="text-xs text-stone-500">{formatEventDate(event.starts_at, timeZone)}</div>
            {event.venue && <div className="text-xs text-stone-500">{event.venue}</div>}
            {event.online_url && <div className="text-xs text-stone-500 break-all">{event.online_url}</div>}
          </div>
          <div className="flex gap-1 shrink-0">
            <button type="button" onClick={onEdit} aria-label="Edit event" className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer">
              <Pencil className="w-4 h-4" />
            </button>
            <button type="button" onClick={onDelete} aria-label="Delete event" className="p-2 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-center">
          {([
            ['Registered', summary.registered, 'text-indigo-600'],
            ['Attended', summary.attended, 'text-emerald-600'],
            ['No-show', summary.no_show, 'text-amber-600'],
            ['Places left', left === null ? '∞' : left, 'text-stone-600'],
          ] as const).map(([label, value, tone]) => (
            <div key={label} className="p-2 rounded-xl border border-stone-200">
              <div className={`text-xs uppercase font-semibold leading-tight ${tone}`}>{label}</div>
              <div className="text-lg font-bold text-stone-900">{value}</div>
            </div>
          ))}
        </div>

        <button type="button" onClick={() => setShowQr((v) => !v)} disabled={!code}
          className="w-full py-2.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-700 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
          <QrCode className="w-4 h-4" />
          <span>{showQr ? 'Hide check-in QR' : 'Show check-in QR'}</span>
        </button>
        {showQr && code && (
          <div className="p-4 bg-stone-50 rounded-2xl flex flex-col items-center gap-2">
            <div className="p-3 bg-white rounded-xl"><QRCodeSVG value={checkinUrl} size={180} level="M" /></div>
            <div className="font-mono text-sm font-bold tracking-widest text-stone-800">{code}</div>
            <p className="text-xs text-stone-500 text-center">
              Show this at the event. Attendees scan it with their phone, sign in, and are marked as attended.
              It works from 2 hours before the start until the end.
            </p>
          </div>
        )}
      </div>

      {message && <div role="status" className="p-3 rounded-xl bg-stone-100 text-xs text-stone-700">{message}</div>}

      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900">Registrations ({registrations.length})</h2>
          <button type="button" onClick={() => setShowGuestForm((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 cursor-pointer">
            <UserPlus className="w-3.5 h-3.5" /> Add guest
          </button>
        </div>

        {showGuestForm && (
          <form onSubmit={submitGuest} className="p-3 rounded-xl bg-stone-50 space-y-2">
            <p className="text-xs text-stone-500">For someone without an account yet, e.g. an intro-talk visitor.</p>
            <input className={inputClass} placeholder="Name" value={guest.name} onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))} />
            <input className={inputClass} type="email" placeholder="Email (optional)" value={guest.email} onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))} />
            <input className={inputClass} type="tel" placeholder="Phone (optional)" value={guest.phone} onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))} />
            <button type="submit" disabled={busy}
              className="w-full py-2.5 rounded-xl bg-stone-900 text-stone-100 text-xs font-semibold disabled:opacity-50">
              Add guest
            </button>
          </form>
        )}

        {sorted.length === 0 && <p className="text-xs text-stone-500 italic">Nobody has registered yet.</p>}
        <div className="divide-y divide-stone-100">
          {sorted.map((r) => (
            <div key={r.id} className="py-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-stone-900 truncate">
                    {attendeeName(r)}
                    {!r.profile_id && <span className="ms-1.5 text-xs text-stone-500">guest</span>}
                  </div>
                  <div className="text-xs text-stone-500 truncate">
                    {[r.profile?.email || r.guest_email, r.guest_phone].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLASS[r.status]}`}>
                  {REGISTRATION_STATUS_LABEL[r.status]}
                </span>
              </div>
              <div className="flex gap-1.5">
                {r.status !== 'attended' && (
                  <button type="button" disabled={busy} onClick={() => changeStatus(r, 'attended')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer">Attended</button>
                )}
                {r.status !== 'no_show' && (
                  <button type="button" disabled={busy} onClick={() => changeStatus(r, 'no_show')}
                    className="px-2.5 py-1 rounded-lg border border-stone-200 text-xs text-stone-600 disabled:opacity-50 cursor-pointer">No-show</button>
                )}
                {r.status !== 'cancelled' && (
                  <button type="button" disabled={busy} onClick={() => changeStatus(r, 'cancelled')}
                    className="px-2.5 py-1 rounded-lg border border-stone-200 text-xs text-stone-600 disabled:opacity-50 cursor-pointer">Cancel</button>
                )}
                {r.status !== 'registered' && (
                  <button type="button" disabled={busy} onClick={() => changeStatus(r, 'registered')}
                    className="px-2.5 py-1 rounded-lg text-xs text-stone-500 disabled:opacity-50 cursor-pointer">Undo</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editForm}
    </div>
  );
};
