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

/** Organisation settings (admins): name, app name, contact email, time zone, footer. */
export const OrganisationSettings: React.FC<OrganisationSettingsProps> = ({ organisation, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: organisation.name || '',
    app_name: organisation.app_name || '',
    support_email: organisation.support_email || '',
    timezone: organisation.timezone || 'Asia/Dubai',
    footer_text: organisation.footer_text || '',
  });
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
    setSaving(true);
    const { data, error: err } = await supabase
      .from('organisations')
      .update({
        name: form.name.trim(),
        app_name: form.app_name.trim(),
        support_email: form.support_email.trim(),
        timezone: form.timezone,
        footer_text: form.footer_text.trim(),
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
