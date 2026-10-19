import React, { useEffect, useMemo, useRef, useState } from 'react';
import { recordCheckin } from '../lib/checkinService';
import { queueTick } from '../lib/offlineTicks';
import { calculateStreak, countPractisedDays, getTrailDayStatus, hasEvening, hasMorning } from '../lib/practiceUtils';
import { formatDateDisplay } from '../lib/dateUtils';
import { useI18n } from '../i18n';
import type { Checkin } from '../types/database';
import { Check, Flame, Loader2, Lock, Moon, Sparkles, Sun, History } from 'lucide-react';

interface PracticeCheckinProps {
  orgId: string;
  batchId: string;
  studentId: string;
  startDate: string;
  timeZone: string;
  todayDay: number;
  durationDays: number;
  practiceName: string;
  question: string;
  checkins: Checkin[];
  onCheckinsChange: (next: Checkin[]) => void;
  /** Set when the saved ticks could not be loaded: the tiles stay locked so nothing is overwritten */
  loadError?: string | null;
  onRetry?: () => void;
}

/** The list with this day's row replaced (or added). */
function withDay(list: Checkin[], row: Checkin): Checkin[] {
  return [...list.filter((c) => c.day_number !== row.day_number), row].sort((a, b) => a.day_number - b.day_number);
}

/** The date of a day of the batch, e.g. "Mon 12 Oct". */
function dayDate(startDate: string, day: number, timeZone: string): string {
  const d = new Date(`${startDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + day - 1);
  return formatDateDisplay(d.toISOString().slice(0, 10), timeZone);
}

/**
 * Daily practice (PM decision 2026-10-18): Morning and Evening ticks, no rest
 * days. A day counts when at least one is ticked. Any past day of the batch
 * can be filled in from the trail.
 */
export const PracticeCheckin: React.FC<PracticeCheckinProps> = ({
  orgId,
  batchId,
  studentId,
  startDate,
  timeZone,
  todayDay,
  durationDays,
  practiceName,
  question,
  checkins,
  onCheckinsChange,
  loadError = null,
  onRetry,
}) => {
  const { t, lang } = useI18n();
  const lastOpenDay = Math.min(todayDay, durationDays);
  const [selectedDay, setSelectedDay] = useState<number>(Math.max(1, lastOpenDay));

  // A new day began while the app was open: follow "today" unless a past day was picked
  const shownToday = useRef(todayDay);
  useEffect(() => {
    if (shownToday.current !== todayDay) {
      setSelectedDay((day) => (day === Math.min(shownToday.current, durationDays) ? Math.max(1, lastOpenDay) : day));
      shownToday.current = todayDay;
    }
  }, [todayDay, durationDays, lastOpenDay]);
  const [saving, setSaving] = useState<'morning' | 'evening' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // The trail shows this week only until the person asks for every day
  const [showAllDays, setShowAllDays] = useState(false);

  const byDay = useMemo(() => new Map(checkins.map((c) => [c.day_number, c])), [checkins]);
  const streak = calculateStreak(checkins, todayDay, durationDays);
  const practised = countPractisedDays(checkins, lastOpenDay);
  // The week on the trail, and how many of its open days were practised
  const weekStart = Math.floor((Math.min(Math.max(todayDay, 1), durationDays) - 1) / 7) * 7 + 1;
  const weekLastOpen = Math.min(weekStart + 6, lastOpenDay);
  const weekOpenDays = Math.max(0, weekLastOpen - weekStart + 1);
  const weekPractised = weekOpenDays ? countPractisedDays(checkins, weekLastOpen) - countPractisedDays(checkins, weekStart - 1) : 0;
  const selected = byDay.get(selectedDay);
  const morning = hasMorning(selected);
  const evening = hasEvening(selected);
  const isToday = selectedDay === todayDay;
  const notStarted = todayDay < 1;
  const finished = todayDay > durationDays;

  const toggle = async (slot: 'morning' | 'evening') => {
    if (saving || loadError || selectedDay < 1 || selectedDay > lastOpenDay) return;
    const value = !(slot === 'morning' ? morning : evening);
    const next = { morning, evening, [slot]: value };
    setSaving(slot);
    setMessage(null);

    const previous = checkins;
    const optimistic: Checkin = {
      id: selected?.id || `temp-${selectedDay}`,
      org_id: orgId,
      batch_id: batchId,
      student_id: studentId,
      day_number: selectedDay,
      status: next.morning || next.evening ? 'done' : 'not_yet',
      morning: next.morning,
      evening: next.evening,
      late: selected?.late || selectedDay < todayDay,
      created_at: selected?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    onCheckinsChange(withDay(checkins, optimistic));

    // Only the tapped tick is saved; the saved row (with its real id) replaces the guess
    const res = await recordCheckin(orgId, batchId, studentId, selectedDay, slot, value);
    setSaving(null);
    if (res.success && res.checkin) {
      onCheckinsChange(withDay(previous, res.checkin));
    } else if (res.offline) {
      // Keep the tick on this phone; it is sent when the connection is back
      queueTick({ orgId, batchId, studentId, day: selectedDay, slot, value });
      setMessage(t('checkin.savedOffline'));
    } else {
      onCheckinsChange(previous);
      setMessage(t('checkin.notSaved', { reason: res.error || t('common.tryAgainLower') }));
    }
  };

  const tile = (slot: 'morning' | 'evening', on: boolean) => {
    const Icon = slot === 'morning' ? Sun : Moon;
    return (
      <button
        type="button"
        onClick={() => toggle(slot)}
        disabled={saving !== null || Boolean(loadError) || notStarted || selectedDay > lastOpenDay}
        aria-pressed={on}
        className={`relative flex-1 rounded-[1.25rem] p-4 text-start transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer ${
          on
            ? slot === 'morning'
              ? 'bg-[#FFF0C2] text-[#6B4A00] ring-2 ring-[#B07D00]'
              : 'bg-[#E9E7FF] text-[#302777] ring-2 ring-[#6E63D9]'
            : 'bg-stone-900/[0.03] text-stone-700 ring-1 ring-stone-900/[0.07] hover:bg-stone-900/[0.05]'
        }`}
      >
        <div className="flex items-center justify-between">
          <Icon className="w-5 h-5" />
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
              on ? `${slot === 'morning' ? 'bg-[#6B4A00]' : 'bg-[#302777]'} text-white scale-100` : 'ring-1 ring-stone-900/15 scale-90'
            }`}
          >
            {saving === slot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : on ? <Check className="w-3.5 h-3.5" /> : null}
          </span>
        </div>
        <div className="mt-3 text-base font-semibold">{slot === 'morning' ? t('checkin.morning') : t('checkin.evening')}</div>
        <div className={`text-sm ${on ? 'font-medium' : 'text-stone-600'}`}>{on ? t('checkin.done') : t('checkin.tapWhenDone')}</div>
      </button>
    );
  };

  return (
    <>
      {/* 1. Check in (today, or the day picked on the trail) */}
      <section id="tour-checkin-card" className="ui-card space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="ui-eyebrow">
            {notStarted ? t('checkin.startsSoon') : finished && selectedDay === lastOpenDay ? t('checkin.complete') : t('common.dayOf', { day: selectedDay, total: durationDays })}
          </span>
          {!notStarted && (
            <span className="text-xs text-stone-500">
              {isToday ? t('common.today') : dayDate(startDate, selectedDay, timeZone)}
            </span>
          )}
        </div>

        <h2 className="font-display text-xl font-semibold text-stone-950 leading-snug">
          {notStarted
            ? t('checkin.beginsOn', { practice: practiceName, date: formatDateDisplay(startDate, timeZone) })
            : isToday
            ? lang === 'en' ? question : t('checkin.question')
            : t('checkin.pastQuestion', { day: selectedDay })}
        </h2>

        {notStarted ? (
          <div className="p-4 rounded-2xl bg-stone-900/[0.03] text-xs text-stone-500 flex items-center gap-2">
            <Lock className="w-4 h-4" /> {t('checkin.opensDay1')}
          </div>
        ) : (
          <>
            <div id="tour-checkin-buttons" className="flex gap-3">
              {tile('morning', morning)}
              {tile('evening', evening)}
            </div>
            <p className="text-xs text-stone-500 min-h-[16px]" aria-live="polite">
              {loadError ? (
                <span className="text-red-600">
                  {t('checkin.loadFailed')} {loadError}{' '}
                  {onRetry && (
                    <button type="button" onClick={onRetry} className="underline font-medium cursor-pointer">
                      {t('common.tryAgain')}
                    </button>
                  )}
                </span>
              ) : message ? (
                <span className="text-red-600">{message}</span>
              ) : !isToday ? (
                <>
                  {t('checkin.pastDay')}{' '}
                  {lastOpenDay === todayDay && (
                    <button type="button" onClick={() => setSelectedDay(todayDay)} className="underline text-stone-700 cursor-pointer">
                      {t('checkin.backToToday')}
                    </button>
                  )}
                </>
              ) : morning && evening ? (
                t('checkin.bothDone')
              ) : morning || evening ? (
                t('checkin.oneDone')
              ) : (
                t('checkin.noneDone')
              )}
            </p>
          </>
        )}
      </section>

      {/* 2. Streak (the flame) and the trail */}
      <section className="ui-card space-y-4">
        <div id="tour-streak-card" className="flex items-center gap-4">
          <div className="relative w-14 h-14 shrink-0">
            <div className={`absolute inset-0 rounded-full blur-xl ${streak > 0 ? 'bg-amber-400/50' : 'bg-stone-300/40'}`} />
            <div className={`relative w-14 h-14 rounded-full flex items-center justify-center ${streak > 0 ? 'bg-gradient-to-b from-amber-300 to-orange-500' : 'bg-stone-200'}`}>
              <Flame className={`w-7 h-7 ${streak > 0 ? 'text-white fill-white/30' : 'text-stone-500'}`} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-2xl font-semibold text-stone-950 leading-none">
              {streak} <span className="text-base font-medium text-stone-500">{streak === 1 ? t('checkin.dayInRow') : t('checkin.daysInRow')}</span>
            </div>
            <p className="text-sm font-medium text-stone-800 mt-1.5 tabular-nums">
              {t('checkin.soFar', { done: practised, total: Math.max(0, lastOpenDay) })}
            </p>
            <p className="text-sm text-stone-600 mt-1">
              {t('checkin.flameHelp')}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-stone-900">{showAllDays ? t('checkin.allDays', { total: durationDays }) : t('checkin.thisWeek')}</span>
          {!showAllDays && (
            <span className="text-stone-600 tabular-nums">{t('checkin.weekCount', { done: weekPractised, total: weekOpenDays })}</span>
          )}
        </div>

        <div id="tour-practice-trail" className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: durationDays }).map((_, idx) => {
            const day = idx + 1;
            if (!showAllDays && (day < weekStart || day > weekStart + 6)) return null;
            const status = getTrailDayStatus(day, todayDay, byDay.get(day));
            const open = day <= lastOpenDay;
            const isSelected = open && day === selectedDay;
            const base = 'aspect-square min-h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all relative';
            const look =
              status === 'full'
                ? 'bg-emerald-500 text-white'
                : status === 'morning'
                ? 'text-emerald-950 bg-[linear-gradient(to_bottom,#34d399_50%,#ecfdf5_50%)] ring-1 ring-emerald-500/40'
                : status === 'evening'
                ? 'text-emerald-950 bg-[linear-gradient(to_top,#34d399_50%,#ecfdf5_50%)] ring-1 ring-emerald-500/40'
                : status === 'today'
                ? 'bg-white text-emerald-700 ring-2 ring-emerald-500'
                : status === 'missed'
                ? 'bg-white text-stone-500 ring-1 ring-stone-900/10'
                : 'text-stone-300';
            return (
              <button
                key={day}
                type="button"
                disabled={!open}
                onClick={() => {
                  setSelectedDay(day);
                  setMessage(null);
                  document.getElementById('tour-checkin-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                aria-label={`${t('common.day', { day })}${status === 'full' ? `, ${t('checkin.ariaBoth')}` : status === 'morning' ? `, ${t('checkin.ariaMorning')}` : status === 'evening' ? `, ${t('checkin.ariaEvening')}` : status === 'missed' ? `, ${t('checkin.ariaMissed')}` : ''}`}
                className={`${base} ${look} ${open ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'} ${
                  isSelected ? 'outline outline-2 outline-offset-2 outline-stone-900' : ''
                }`}
              >
                {status === 'full' ? <Check className="w-3.5 h-3.5" /> : day}
                {byDay.get(day)?.late && status !== 'missed' && (
                  <History className="absolute -top-0.5 -end-0.5 w-3 h-3 p-[1px] rounded-full bg-white text-stone-500" />
                )}
              </button>
            );
          })}
        </div>

        {durationDays > 7 && (
          <button type="button" onClick={() => setShowAllDays((v) => !v)} aria-expanded={showAllDays} className="ui-btn-ghost w-full">
            {showAllDays ? t('checkin.showWeek') : t('checkin.showAll', { total: durationDays })}
          </button>
        )}

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm text-stone-600">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500" /> {t('checkin.legendBoth')}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full ring-1 ring-emerald-500/40 bg-[linear-gradient(to_bottom,#34d399_50%,#ecfdf5_50%)]" /> {t('checkin.legendMorningOnly')}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full ring-1 ring-emerald-500/40 bg-[linear-gradient(to_top,#34d399_50%,#ecfdf5_50%)]" /> {t('checkin.legendEveningOnly')}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-white ring-1 ring-stone-900/15" /> {t('checkin.legendMissed')}</span>
          <span className="flex items-center gap-1.5"><History className="w-3 h-3" /> {t('checkin.legendLate')}</span>
        </div>
        <p className="text-sm text-center text-stone-600 flex items-center justify-center gap-1">
          <Sparkles className="w-4 h-4" /> {t('checkin.forgotDay')}
        </p>
      </section>
    </>
  );
};
