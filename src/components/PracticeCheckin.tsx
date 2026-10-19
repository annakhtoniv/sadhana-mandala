import React, { useEffect, useMemo, useRef, useState } from 'react';
import { recordCheckin } from '../lib/checkinService';
import { queueTick } from '../lib/offlineTicks';
import {
  calculateStreak,
  countPractisedDays,
  earnedBadges,
  fullWeeks,
  getTrailDayStatus,
  hasEvening,
  hasMorning,
  weekProgress,
  type BadgeId,
} from '../lib/practiceUtils';
import { addDays, formatDateDisplay, formatDateRange } from '../lib/dateUtils';
import { currentLocale } from '../i18n/locale';
import { badgeLook, badgesFor } from '../lib/badges';
import { setMyAvatarFrame } from '../lib/avatarService';
import { useAuth } from '../context/AuthContext';
import { badgeImage, certificatePdf, download, sharePicture } from '../lib/shareImage';
import { fetchBatchMilestones, MOODS, saveReflection, type Milestone, type Mood } from '../lib/engagementService';
import { useI18n } from '../i18n';
import type { Checkin } from '../types/database';
import { Check, Flame, Loader2, Lock, Moon, Sparkles, Sun, History, Award, Share2, FileDown, Users } from 'lucide-react';

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
  /** Phase 22: for the certificate and the shared badge picture */
  studentName?: string;
  batchName?: string;
  teacherName?: string;
  endDate?: string;
  orgName?: string;
  appName?: string;
}

/** The list with this day's row replaced (or added). */
function withDay(list: Checkin[], row: Checkin): Checkin[] {
  return [...list.filter((c) => c.day_number !== row.day_number), row].sort((a, b) => a.day_number - b.day_number);
}

/** The calendar date of a day of the batch, as "Mon, 19 Oct" and as the two short parts the trail shows. */
function dayParts(startDate: string, day: number, timeZone: string, lang: string) {
  const iso = addDays(startDate, day - 1);
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const fmt = (o: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(currentLocale(), { timeZone, ...o }).format(date);
    } catch {
      return formatDateDisplay(iso, timeZone);
    }
  };
  return {
    full: fmt({ weekday: 'short', day: 'numeric', month: 'short' }),
    // Arabic weekday and month names are long: a one-letter day and a numeric date fit the small circle
    weekday: fmt({ weekday: lang === 'ar' ? 'narrow' : 'short' }),
    date: fmt(lang === 'ar' ? { day: 'numeric', month: 'numeric' } : { day: 'numeric', month: 'short' }),
  };
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
  studentName = '',
  batchName = '',
  teacherName = '',
  endDate,
  orgName = '',
  appName = '',
}) => {
  const { t, lang } = useI18n();
  const { refreshProfile } = useAuth();
  // A badge just earned with a tick (Phase 21), and the result of using it as a frame
  const [celebrate, setCelebrate] = useState<BadgeId | null>(null);
  const [frameNote, setFrameNote] = useState<string | null>(null);
  // Phase 22: the batch's milestones, the certificate and the reflection on the chosen day
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [certBusy, setCertBusy] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [note, setNote] = useState('');
  const [reflectNote, setReflectNote] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    fetchBatchMilestones(batchId).then(setMilestones).catch(() => setMilestones([]));
  }, [batchId, todayDay]);
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
  // Phase 21: weekly badges and a line that cheers on this week
  const earned = useMemo(() => earnedBadges(checkins, durationDays), [checkins, durationDays]);
  const badgeIds = badgesFor(durationDays, fullWeeks(durationDays));
  const week = weekProgress(checkins, todayDay, durationDays);
  const weekNote = (() => {
    if (!week || todayDay > durationDays) return null;
    const weekLen = week.lastDay - week.firstDay + 1;
    if (!week.earnsBadge) return t('week.finalDays', { n: durationDays - todayDay + 1, total: durationDays });
    if (!week.unbroken) return t('week.broken');
    if (week.done === weekLen) return t('week.complete', { w: week.week });
    if (weekLen - week.done === 1 && todayDay === week.lastDay) return t('week.lastDay', { w: week.week });
    return t('week.moreForBadge', { n: weekLen - week.done, w: week.week });
  })();

  const useAsFrame = async (id: BadgeId) => {
    const look = badgeLook(id);
    const res = await setMyAvatarFrame(id);
    if (res.success) {
      await refreshProfile();
      setFrameNote(t('celebrate.frameSet', { badge: look ? t(look.nameKey) : id }));
    } else {
      setFrameNote(t('frame.failed'));
    }
  };

  const site = typeof window !== 'undefined' ? window.location.host : '';
  const share = async (id: BadgeId) => {
    const look = badgeLook(id);
    if (!look) return;
    const title = id === 'complete' ? t('share.allText', { total: durationDays }) : t('share.weekText', { w: id.slice(4) });
    try {
      const blob = await badgeImage({ look, title, subtitle: `${studentName}${batchName ? ` · ${batchName}` : ''}`, footer: `${appName} · ${site}`, rtl: lang === 'ar' });
      await sharePicture(blob, `${id}.png`, `${title}\n${t('share.invite', { site: `https://${site}` })}`);
    } catch {
      // Sharing was cancelled or is not possible on this phone
    }
  };

  const downloadCertificate = async () => {
    const look = badgeLook('complete');
    if (!look) return;
    setCertBusy(true);
    setCertError(null);
    try {
      const blob = await certificatePdf(
        {
          heading: t('cert.heading'),
          certifies: t('cert.certifies'),
          name: studentName,
          completed: t('cert.completed', { total: durationDays, practice: practiceName }),
          details: t('cert.details', { batch: batchName, dates: formatDateRange(startDate, endDate || addDays(startDate, durationDays - 1), timeZone) }),
          teacher: teacherName ? t('cert.teacher', { teacher: teacherName }) : '',
          org: orgName,
        },
        look,
        lang === 'ar'
      );
      download(blob, `certificate-${batchName.replace(/[^\p{L}\p{N}]+/gu, '-')}.pdf`);
    } catch {
      setCertError(t('cert.failed'));
    }
    setCertBusy(false);
  };

  const saveMyReflection = async () => {
    const res = await saveReflection(batchId, studentId, selectedDay, mood, note);
    if (res.success && selected) onCheckinsChange(withDay(checkins, { ...selected, mood, note: note.trim() || null }));
    setReflectNote(res.success ? { ok: true, text: t('reflect.saved') } : { ok: false, text: res.error || t('reflect.failed') });
  };
  const lastMilestone = milestones.length ? milestones[milestones.length - 1] : null;
  const selected = byDay.get(selectedDay);
  const morning = hasMorning(selected);
  const evening = hasEvening(selected);
  const isToday = selectedDay === todayDay;
  useEffect(() => {
    setMood((selected?.mood as Mood | null) || null);
    setNote(selected?.note || '');
    setReflectNote(null);
  }, [selectedDay, selected?.id]);
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
    // A tick that completes a week (or the whole practice) earns a badge
    if (value && (res.success || res.offline)) {
      const before = new Set(earnedBadges(previous, durationDays));
      const fresh = earnedBadges(withDay(previous, optimistic), durationDays).filter((b) => !before.has(b));
      if (fresh.length) {
        setCelebrate(fresh.includes('complete') ? 'complete' : fresh[fresh.length - 1]);
        setFrameNote(null);
      }
    }
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
              {isToday ? `${t('common.today')} · ` : ''}{dayParts(startDate, selectedDay, timeZone, lang).full}
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
            {celebrate && (
              <div role="status" className="p-4 rounded-2xl bg-amber-50 ring-1 ring-amber-200 space-y-2 animate-fade-up">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ background: `conic-gradient(from 210deg, ${badgeLook(celebrate)!.from}, ${badgeLook(celebrate)!.to}, ${badgeLook(celebrate)!.from})` }}
                  >
                    {badgeLook(celebrate)!.emblem}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-stone-950">
                      {celebrate === 'complete' ? t('celebrate.allTitle', { total: durationDays }) : t('celebrate.weekTitle', { w: celebrate.slice(4) })}
                    </div>
                    <div className="text-sm text-stone-700">
                      {t(celebrate === 'complete' ? 'celebrate.allText' : 'celebrate.weekText', { badge: t(badgeLook(celebrate)!.nameKey) })}
                    </div>
                  </div>
                </div>
                {frameNote ? (
                  <p className="text-sm font-medium text-stone-800">{frameNote}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => useAsFrame(celebrate)} className="ui-btn-primary !min-h-10 !py-2 !px-4">{t('celebrate.useFrame')}</button>
                    <button type="button" onClick={() => setCelebrate(null)} className="ui-btn-ghost !min-h-10 !py-2 !px-4">{t('celebrate.later')}</button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => share(celebrate)} className="ui-btn-ghost !min-h-10 !py-2 !px-4">
                    <Share2 className="w-4 h-4" aria-hidden="true" /> {t('share.button')}
                  </button>
                  {celebrate === 'complete' && (
                    <button type="button" onClick={downloadCertificate} disabled={certBusy} className="ui-btn-ghost !min-h-10 !py-2 !px-4">
                      <FileDown className="w-4 h-4" aria-hidden="true" /> {certBusy ? t('cert.preparing') : t('cert.button')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Phase 22: a short reflection on a practised day */}
            {(morning || evening) && !loadError && (
              <div className="pt-3 border-t border-stone-100 space-y-2">
                <div className="text-sm font-semibold text-stone-900">{t('reflect.title')}</div>
                <div role="radiogroup" aria-label={t('reflect.title')} className="flex flex-wrap gap-1.5">
                  {MOODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={mood === m}
                      onClick={() => {
                        setMood(mood === m ? null : m);
                        setReflectNote(null);
                      }}
                      className={`min-h-10 px-3 rounded-full text-sm ring-1 cursor-pointer ${mood === m ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-700 ring-stone-300'}`}
                    >
                      {t(`reflect.mood.${m}` as 'reflect.mood.calm')}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    aria-label={t('reflect.placeholder')}
                    className="ui-input flex-1 min-w-0"
                    maxLength={280}
                    placeholder={t('reflect.placeholder')}
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value);
                      setReflectNote(null);
                    }}
                  />
                  <button type="button" onClick={saveMyReflection} className="ui-btn-ghost shrink-0">{t('reflect.save')}</button>
                </div>
                <p className={`text-xs ${reflectNote && !reflectNote.ok ? 'text-red-700' : 'text-stone-500'}`} role={reflectNote ? (reflectNote.ok ? 'status' : 'alert') : undefined}>
                  {reflectNote ? reflectNote.text : t('reflect.private')}
                </p>
              </div>
            )}
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
            // Phase 21: each day shows its weekday and date with the day number
            const base = 'min-h-[3.75rem] rounded-2xl flex flex-col items-center justify-center leading-tight transition-all relative py-1';
            const when = dayParts(startDate, day, timeZone, lang);
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
                aria-label={`${t('common.day', { day })}, ${when.full}${status === 'full' ? `, ${t('checkin.ariaBoth')}` : status === 'morning' ? `, ${t('checkin.ariaMorning')}` : status === 'evening' ? `, ${t('checkin.ariaEvening')}` : status === 'missed' ? `, ${t('checkin.ariaMissed')}` : ''}`}
                className={`${base} ${look} ${open ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'} ${
                  isSelected ? 'outline outline-2 outline-offset-2 outline-stone-900' : ''
                }`}
              >
                <span className="text-[11px] opacity-80">{when.weekday}</span>
                <span className="text-sm font-semibold">{day}</span>
                <span dir={lang === 'ar' ? 'ltr' : undefined} className="text-[11px] opacity-80 whitespace-nowrap">{when.date}</span>
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

        {weekNote && <p className="text-sm font-medium text-stone-800 text-center">{weekNote}</p>}
        {lastMilestone && lastMilestone.students > 1 && (
          <p className="text-sm text-stone-700 text-center flex items-center justify-center gap-1.5">
            <Users className="w-4 h-4 shrink-0 text-emerald-700" aria-hidden="true" />
            {t('together.line', { done: lastMilestone.completed, total: lastMilestone.students, w: lastMilestone.week })}
          </p>
        )}

        {badgeIds.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-600" aria-hidden="true" /> {t('badges.title')}
            </div>
            <ul className="grid grid-cols-6 gap-1.5">
              {badgeIds.map((id) => {
                const look = badgeLook(id)!;
                const got = earned.includes(id);
                const label = id === 'complete' ? t('badges.all', { total: durationDays }) : t('badges.week', { n: id.slice(4) });
                return (
                  <li key={id} className="flex flex-col items-center gap-1 text-center" aria-label={got ? undefined : `${label}: ${t(look.nameKey)}, ${t('badges.locked')}`}>
                    {got ? (
                      <button
                        type="button"
                        onClick={() => share(id)}
                        aria-label={`${label}: ${t(look.nameKey)}, ${t('badges.earned')}. ${t('share.button')}`}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm cursor-pointer"
                        style={{ background: `conic-gradient(from 210deg, ${look.from}, ${look.to}, ${look.from})` }}
                      >
                        {look.emblem}
                      </button>
                    ) : (
                      <span aria-hidden="true" className="w-10 h-10 rounded-full flex items-center justify-center bg-stone-100 text-stone-400 ring-1 ring-stone-900/10">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <span aria-hidden="true" className={`text-[11px] leading-tight ${got ? 'text-stone-800 font-medium' : 'text-stone-500'}`}>{label}</span>
                  </li>
                );
              })}
            </ul>
            {earned.includes('complete') && (
              <button type="button" onClick={downloadCertificate} disabled={certBusy} className="ui-btn-primary w-full">
                <FileDown className="w-4 h-4" aria-hidden="true" /> {certBusy ? t('cert.preparing') : t('cert.button')}
              </button>
            )}
            {certError && <p role="alert" className="text-sm text-red-700">{certError}</p>}
          </div>
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
