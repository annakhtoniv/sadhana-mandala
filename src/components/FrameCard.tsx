import React, { useEffect, useState } from 'react';
import { Award, Check } from 'lucide-react';
import { useT } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { badgeLook, weekNumber } from '../lib/badges';
import { fetchMyEarnedBadges, setMyAvatarFrame } from '../lib/avatarService';

/**
 * Phase 21: put an earned weekly badge around the profile photo. The badges
 * come from the database (all of the person's practices), which also checks
 * that a frame was earned before saving it.
 */
export const FrameCard: React.FC = () => {
  const t = useT();
  const { profile, refreshProfile } = useAuth();
  const [earned, setEarned] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetchMyEarnedBadges().then(setEarned).catch(() => setEarned([]));
  }, []);

  if (earned === null) return null;
  const current = profile?.avatar_frame || null;
  // Weeks in order, then the whole practice
  const sorted = [...earned].sort((a, b) => (weekNumber(a) ?? 99) - (weekNumber(b) ?? 99));

  const choose = async (frame: string | null) => {
    setBusy(true);
    setNote(null);
    const res = await setMyAvatarFrame(frame);
    if (res.success) await refreshProfile();
    setBusy(false);
    setNote(res.success ? { ok: true, text: t('frame.saved') } : { ok: false, text: t('frame.failed') });
  };

  const option = (frame: string | null, label: string, look: ReturnType<typeof badgeLook>) => {
    const chosen = current === frame;
    return (
      <button
        key={frame || 'none'}
        type="button"
        role="radio"
        aria-checked={chosen}
        disabled={busy}
        onClick={() => choose(frame)}
        className={`min-h-12 px-3 py-2 rounded-2xl ring-1 flex items-center gap-2 text-sm font-medium cursor-pointer transition-colors ${
          chosen ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-800 ring-stone-300 hover:bg-stone-50'
        }`}
      >
        {look ? (
          <span
            aria-hidden="true"
            className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: `conic-gradient(from 210deg, ${look.from}, ${look.to}, ${look.from})` }}
          >
            {look.emblem}
          </span>
        ) : null}
        <span>{label}</span>
        {chosen && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <section className="ui-card space-y-3">
      <h2 className="font-display text-lg font-semibold text-stone-950 flex items-center gap-2">
        <Award className="w-5 h-5 text-amber-600" aria-hidden="true" /> {t('frame.title')}
      </h2>
      {sorted.length === 0 ? (
        <p className="text-base text-stone-600">{t('frame.noneEarned')}</p>
      ) : (
        <>
          <p className="text-sm text-stone-600">{t('frame.help')}</p>
          <div role="radiogroup" aria-label={t('frame.title')} className="flex flex-wrap gap-2">
            {option(null, t('frame.none'), null)}
            {sorted.map((id) => {
              const look = badgeLook(id);
              if (!look) return null;
              const w = weekNumber(id);
              return option(id, `${t(look.nameKey)}${w ? ` · ${t('badges.week', { n: w })}` : ''}`, look);
            })}
          </div>
        </>
      )}
      {note && <p role={note.ok ? 'status' : 'alert'} className={`text-sm ${note.ok ? 'text-emerald-800' : 'text-red-700'}`}>{note.text}</p>}
    </section>
  );
};
