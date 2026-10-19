import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2, Share } from 'lucide-react';
import { useT } from '../i18n';
import { reminderState, resyncReminders, turnRemindersOff, turnRemindersOn, type ReminderState } from '../lib/pushReminders';

const DISMISS_KEY = 'sadhana_reminders_not_now';

/**
 * Phase 18: daily practice reminders for this phone.
 * In Profile it always shows. On the home screen (compact) it shows only
 * while reminders can still be turned on, until the person taps "Not now".
 */
export const RemindersCard: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const t = useT();
  const [state, setState] = useState<ReminderState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return compact && localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let alive = true;
    reminderState().then((s) => alive && setState(s)).catch(() => alive && setState('unsupported'));
    // The browser can renew this phone's address; keep the saved one current
    resyncReminders().catch(() => {});
    return () => {
      alive = false;
    };
  }, [compact]);

  if (state === null || dismissed) return null;
  if (compact && state !== 'off' && state !== 'install-first') return null;
  if (!compact && (state === 'unsupported' || state === 'not-ready')) {
    return (
      <section className="ui-card space-y-2">
        <h2 className="font-display text-lg font-semibold text-stone-950 flex items-center gap-2">
          <BellOff className="w-5 h-5 text-stone-500" aria-hidden="true" /> {t('reminders.title')}
        </h2>
        <p className="text-base text-stone-600">
          {state === 'not-ready' ? t('reminders.notReady') : t('reminders.unsupported', { site: window.location.host })}
        </p>
      </section>
    );
  }

  const toggle = async () => {
    setBusy(true);
    setFailed(false);
    try {
      setState(state === 'on' ? await turnRemindersOff() : await turnRemindersOn());
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  const notNow = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // only hidden for now
    }
    setDismissed(true);
  };

  return (
    <section className="ui-card space-y-3">
      <h2 className="font-display text-lg font-semibold text-stone-950 flex items-center gap-2">
        <Bell className="w-5 h-5 text-emerald-700" /> {t('reminders.title')}
      </h2>
      <p className="text-base text-stone-600">{t('reminders.help')}</p>

      {state === 'install-first' && (
        <p className="text-base text-stone-700 flex items-start gap-1.5">
          <Share className="w-4 h-4 mt-1 shrink-0" /> {t('reminders.installFirst')}
        </p>
      )}
      {state === 'blocked' && <p className="text-base text-amber-800">{t('reminders.blocked')}</p>}
      {state === 'on' && <p className="text-base text-emerald-800 font-medium">{t('reminders.isOn')}</p>}
      {failed && <p role="alert" className="text-sm text-red-700">{t('reminders.failed')}</p>}

      {(state === 'off' || state === 'on') && (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={state === 'on' ? 'ui-btn-ghost w-full' : 'ui-btn-primary w-full'}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : state === 'on' ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {state === 'on' ? t('reminders.off') : t('reminders.on')}
        </button>
      )}
      {compact && (
        <button type="button" onClick={notNow} className="ui-btn-ghost w-full">
          {t('reminders.notNow')}
        </button>
      )}
    </section>
  );
};
