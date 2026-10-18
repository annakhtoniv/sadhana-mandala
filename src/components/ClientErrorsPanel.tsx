import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ClientError {
  id: string;
  message: string;
  page: string | null;
  app_version: string | null;
  created_at: string;
}

/** Admins: errors the app reported in the last 30 days (newest first). */
export const ClientErrorsPanel: React.FC<{ timeZone: string }> = ({ timeZone }) => {
  const [rows, setRows] = useState<ClientError[] | null>(null);

  useEffect(() => {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    supabase
      .from('client_errors')
      .select('id, message, page, app_version, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => setRows(error ? [] : ((data as ClientError[]) || [])));
  }, []);

  if (rows === null) return null;
  return (
    <section className="ui-card space-y-3" aria-labelledby="client-errors-title">
      <h2 id="client-errors-title" className="text-sm font-semibold text-stone-900 flex items-center gap-2">
        {rows.length === 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
        Problems people ran into (last 30 days)
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-600">None reported. The app sends a note here automatically when something goes wrong on someone's screen.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {rows.map((r) => (
            <li key={r.id} className="py-2">
              <div className="text-sm text-stone-900 break-words">{r.message}</div>
              <div className="text-xs text-stone-500">
                {new Date(r.created_at).toLocaleString('en-GB', { timeZone, dateStyle: 'medium', timeStyle: 'short' })}
                {r.page ? ` · ${r.page}` : ''}
                {r.app_version ? ` · version ${r.app_version}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
