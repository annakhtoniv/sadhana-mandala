import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Organisation } from '../types/database';
import { Loader2 } from 'lucide-react';
import { Sheet } from './Sheet';
import { friendlyError } from '../lib/errors';

const TIMEZONES = [
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
];

interface OrganisationSettingsProps {
  organisation: Organisation;
  onClose: () => void;
  onSaved: (org: Organisation) => void;
}

const inputClass = 'ui-input';
const labelClass = 'ui-label';

const hhmm = (time: string | undefined, fallback: string) => (time || fallback).slice(0, 5);

/** Organisation settings (admins): name, app name, contact email, time zone, footer, daily reminders. */
export const OrganisationSettings: React.FC<OrganisationSettingsProps> = ({ organisation, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: organisation.name || '',
    app_name: organisation.app_name || '',
    support_email: organisation.support_email || '',
    timezone: organisation.timezone || 'Asia/Dubai',
    footer_text: organisation.footer_text || '',
    reminder_morning_time: hhmm(organisation.reminder_morning_time, '06:00'),
    reminder_morning_text: organisation.reminder_morning_text || 'Good morning. Time for your morning practice.',
    reminder_evening_time: hhmm(organisation.reminder_evening_time, '19:00'),
    reminder_evening_text: organisation.reminder_evening_text || 'Time for your evening practice.',
  });
  const [remindersOn, setRemindersOn] = useState(organisation.reminders_enabled !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const zones = TIMEZONES.includes(form.timezone) ? TIMEZONES : [form.timezone, ...TIMEZONES];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.app_name.trim() || !form.footer_text.trim()) {
      setError('Name, app name and footer text are needed.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.support_email.trim())) {
      setError('The contact email does not look right.');
      return;
    }
    if (!form.reminder_morning_text.trim() || !form.reminder_evening_text.trim()) {
      setError('Both reminder texts are needed.');
      return;
    }
    setSaving(true);
    const { data, error: err } = await supabase
      .from('organisations')
      .update({
        name: form.name.trim(),
        app_name: form.app_name.trim(),
        support_email: form.support_email.trim(),
        timezone: form.timezone,
        footer_text: form.footer_text.trim(),
        reminders_enabled: remindersOn,
        reminder_morning_time: form.reminder_morning_time,
        reminder_morning_text: form.reminder_morning_text.trim(),
        reminder_evening_time: form.reminder_evening_time,
        reminder_evening_text: form.reminder_evening_text.trim(),
      })
      .eq('id', organisation.id)
      .select()
      .single();
    setSaving(false);
    if (err || !data) {
      setError(err ? friendlyError(err) : 'You do not have permission to change these settings.');
      return;
    }
    onSaved(data as Organisation);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title="Organisation settings" busy={saving}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="org-name">Organisation name</label>
          <input id="org-name" className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="org-app-name">App name (top bar and sign-in page)</label>
          <input id="org-app-name" className={inputClass} value={form.app_name} onChange={(e) => set('app_name', e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="org-email">Contact email for help</label>
          <input id="org-email" type="email" className={inputClass} value={form.support_email} onChange={(e) => set('support_email', e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="org-tz">Time zone</label>
          <select id="org-tz" className={`${inputClass} cursor-pointer`} value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
            {zones.map((z) => (
              <option key={z} value={z}>{z.replace('_', ' ')}</option>
            ))}
          </select>
          {form.timezone !== organisation.timezone && (
            <p className="mt-1 text-xs text-amber-700">
              Each day of a batch starts at midnight in this time zone. Changing it can move today's day number for running batches.
            </p>
          )}
        </div>
        <div>
          <label className={labelClass} htmlFor="org-footer">Footer text</label>
          <input id="org-footer" className={inputClass} value={form.footer_text} onChange={(e) => set('footer_text', e.target.value)} />
        </div>

        <fieldset className="space-y-3 rounded-2xl ring-1 ring-stone-200 p-4">
          <legend className="px-1 text-sm font-semibold text-stone-800">Daily practice reminders</legend>
          <label className="flex items-center gap-2 text-sm text-stone-800 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={remindersOn} onChange={(e) => setRemindersOn(e.target.checked)} />
            Send reminders
          </label>
          <p className="text-xs text-stone-500">
            A notification to everyone in a running batch with a daily practice who turned reminders on, in the time zone above.
          </p>
          <div className="grid grid-cols-[7rem_1fr] gap-2 items-end">
            <div>
              <label className={labelClass} htmlFor="org-rem-m-time">Morning</label>
              <input id="org-rem-m-time" type="time" className={inputClass} disabled={!remindersOn} value={form.reminder_morning_time} onChange={(e) => set('reminder_morning_time', e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="org-rem-m-text">Morning text</label>
              <input id="org-rem-m-text" className={inputClass} maxLength={200} disabled={!remindersOn} value={form.reminder_morning_text} onChange={(e) => set('reminder_morning_text', e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="org-rem-e-time">Evening</label>
              <input id="org-rem-e-time" type="time" className={inputClass} disabled={!remindersOn} value={form.reminder_evening_time} onChange={(e) => set('reminder_evening_time', e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="org-rem-e-text">Evening text</label>
              <input id="org-rem-e-text" className={inputClass} maxLength={200} disabled={!remindersOn} value={form.reminder_evening_text} onChange={(e) => set('reminder_evening_text', e.target.value)} />
            </div>
          </div>
        </fieldset>

        <p className="text-xs text-stone-500">Web address name: {organisation.slug} (fixed)</p>

        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="ui-btn-ghost flex-1 justify-center">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="ui-btn-primary flex-1 justify-center">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
        </div>
      </form>
    </Sheet>
  );
};
