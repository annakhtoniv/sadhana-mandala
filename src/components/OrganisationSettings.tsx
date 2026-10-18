import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Organisation } from '../types/database';
import { Loader2, Settings, X } from 'lucide-react';

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

const inputClass = 'w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
const labelClass = 'block text-xs font-medium text-stone-600 mb-1';

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
      setError(`Could not save: ${err?.message || 'no permission'}`);
      return;
    }
    onSaved(data as Organisation);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-settings-title"
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white rounded-[1.5rem] p-5 shadow-2xl space-y-4 animate-fade-up"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-stone-900" />
            <h2 id="org-settings-title" className="font-display text-lg font-semibold text-stone-950">
              Organisation settings
            </h2>
          </div>
          <button type="button" onClick={onClose} className="ui-icon-btn -mr-1 -mt-1" aria-label="Close settings">
            <X className="w-4 h-4" />
          </button>
        </div>

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
            <p className="mt-1 text-[11px] text-amber-700">
              Each day of a batch starts at midnight in this time zone. Changing it can move today's day number for running batches.
            </p>
          )}
        </div>
        <div>
          <label className={labelClass} htmlFor="org-footer">Footer text</label>
          <input id="org-footer" className={inputClass} value={form.footer_text} onChange={(e) => set('footer_text', e.target.value)} />
        </div>
        <p className="text-[11px] text-stone-400">Web address name: {organisation.slug} (fixed)</p>

        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="ui-btn-ghost flex-1 justify-center">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="ui-btn-primary flex-1 justify-center">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
        </div>
      </form>
    </div>
  );
};
