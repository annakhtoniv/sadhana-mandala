import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/errors';
import { flushTicks, pendingTicks, type PendingTick } from '../lib/offlineTicks';
import { ProgrammeLearning } from './ProgrammeLearning';
import { ProgrammeMaterials } from './ProgrammeMaterials';
import { ProgrammeFollowups } from './ProgrammeFollowups';
import { PracticeCheckin } from './PracticeCheckin';
import { RemindersCard } from './RemindersCard';
import { calculateDayNumber, formatDateDisplay } from '../lib/dateUtils';
import {
  fetchStudentCheckins,
} from '../lib/checkinService';
import {
  hasPracticeTrack,
  practiceTrackName,
  programmeRunStatus,
} from '../lib/programmeUtils';
import type { Checkin, Enrolment } from '../types/database';
import { useT, type MsgKey } from '../i18n';
import {
  Flame,
  Users,
  ArrowRight,
  BookOpen,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface StudentHomeProps {
  onNavigateLessons?: () => void;
}

/** Saved check-ins with the ticks still waiting on this phone applied on top. */
function withPendingTicks(saved: Checkin[], pending: PendingTick[]): Checkin[] {
  const byDay = new Map(saved.map((c) => [c.day_number, { ...c }]));
  for (const t of pending) {
    const row = byDay.get(t.day) || ({ id: `pending-${t.day}`, org_id: t.orgId, batch_id: t.batchId, student_id: t.studentId, day_number: t.day, status: 'not_yet', morning: false, evening: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Checkin);
    row[t.slot] = t.value;
    row.status = row.morning || row.evening ? 'done' : 'not_yet';
    byDay.set(t.day, row);
  }
  return [...byDay.values()].sort((a, b) => a.day_number - b.day_number);
}

export const StudentHome: React.FC<StudentHomeProps> = ({ onNavigateLessons }) => {
  const { organisation, profile, enrolment, enrolments, selectEnrolment, joinBatch } = useAuth();
  const t = useT();
  const statusLabel = (s: string) => t(`status.${s}` as MsgKey);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Checkins state
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [checkinsError, setCheckinsError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Re-read "today" when the app comes back to the front and every minute,
  // so an app left open overnight moves to the new day
  const [clock, setClock] = useState(0);
  useEffect(() => {
    const tick = () => setClock((c) => c + 1);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    const timer = window.setInterval(tick, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
      window.clearInterval(timer);
    };
  }, []);

  const batch = enrolment?.batch;
  const course = batch?.course;
  const durationDays = course?.duration_days || 40;
  // Only programmes with a practice track have the daily check-in (e.g. the 40-day Sadhana)
  const practice = hasPracticeTrack(course);

  // Calculate today's day number in the organisation's timezone
  const todayDayNumber = useMemo(
    () => (batch?.start_date ? calculateDayNumber(batch.start_date, organisation.timezone) : 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [batch?.start_date, organisation.timezone, clock]
  );


  // Load student check-ins when enrolment or profile changes
  useEffect(() => {
    if (!batch?.id || !profile?.id) return;

    let isMounted = true;

    setCheckinsError(null);
    const batchId = batch.id;
    const studentId = profile.id;
    // Ticks made offline are sent first, then shown together with the saved ones
    flushTicks()
      .catch(() => 0)
      .then(() => fetchStudentCheckins(batchId, studentId))
      .then((data) => {
        if (isMounted) {
          setCheckins(withPendingTicks(data, pendingTicks(batchId, studentId)));
        }
      })
      .catch((err) => {
        // Keep what is shown and lock the tiles: an empty list here would let
        // the next tap overwrite ticks that are saved but not loaded
        if (isMounted) {
          setCheckinsError(friendlyError(err));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [batch?.id, profile?.id, reloadKey]);

  // Back online: send waiting ticks and reload
  useEffect(() => {
    const onOnline = () => setReloadKey((k) => k + 1);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // Handle joining batch with code
  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setJoinError(t('join.empty'));
      return;
    }

    setJoining(true);
    setJoinError(null);

    const result = await joinBatch(joinCode);
    if (!result.success) {
      setJoinError(result.message || t('join.invalid'));
    } else {
      setJoinCode('');
    }
    setJoining(false);
  };

  const joinForm = (id: string, label: string) => (
    <form onSubmit={handleJoinByCode} className="space-y-2">
      <label htmlFor={id} className="ui-label">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder={t('join.placeholder')}
          value={joinCode}
          onChange={(e) => {
            setJoinCode(e.target.value.toUpperCase().replace(/\s/g, ''));
            setJoinError(null);
          }}
          maxLength={12}
          aria-invalid={joinError ? true : undefined}
          aria-describedby={joinError ? `${id}-error` : undefined}
          className="ui-input flex-1 min-w-0 font-mono tracking-widest uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case"
        />
        <button type="submit" disabled={joining} className="ui-btn-primary shrink-0">
          {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>{t('join.button')}</span>}
          {!joining && <ArrowRight className="w-4 h-4 rtl:rotate-180" />}
        </button>
      </div>
      {joinError && (
        <p id={`${id}-error`} role="alert" className="p-3 bg-red-50 rounded-xl text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{joinError}</span>
        </p>
      )}
    </form>
  );

  // Not in a batch yet
  if (!enrolment) {
    return (
      <div className="w-full space-y-5 animate-fade-up">
        <section className="ui-card">
          <span className="ui-eyebrow">{t('home.welcomeTo', { app: organisation.app_name })}</span>
          <h1 className="font-display text-2xl font-semibold text-stone-950 mt-3 user-text">{profile?.full_name || t('home.welcome')}</h1>
        </section>

        <section className="ui-card space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold text-stone-950">{t('home.noBatch')}</h2>
              <p className="text-base text-stone-600 leading-relaxed">
                {t('home.noBatchHelp')}
              </p>
            </div>
          </div>
          {joinForm('join-first', t('join.code'))}
          {onNavigateLessons && (
            <button type="button" onClick={onNavigateLessons} className="ui-btn-ghost w-full">
              <BookOpen className="w-4 h-4" />
              <span>{t('home.generalLessons')}</span>
            </button>
          )}
        </section>
      </div>
    );
  }

  const runStatus = programmeRunStatus(course, todayDayNumber);
  const notStarted = todayDayNumber < 1;
  const startText = batch?.start_date ? formatDateDisplay(batch.start_date, organisation.timezone) : '';

  return (
    <div className="w-full space-y-5 animate-fade-up">
      <section className="ui-card space-y-2">
        <span className="ui-eyebrow user-text">{course?.name || t('common.programme')}</span>
        <h1 className="font-display text-2xl font-semibold text-stone-950 mt-1 user-text">{batch?.name}</h1>
        <p className="text-base text-stone-600">
          {startText && (notStarted ? t('home.startsOn', { date: startText }) : t('home.startedOn', { date: startText }))}
          {batch?.teacher && (
            <>
              {startText ? ' · ' : ''}{t('home.teacher')} <span className="user-text">{batch.teacher.full_name || batch.teacher.email}</span>
            </>
          )}
        </p>
      </section>

      {/* My programmes (a student can be in many programmes over time) */}
      {enrolments.length > 1 && (
        <section className="ui-card space-y-2">
          <h2 className="text-sm font-semibold text-stone-700">{t('home.myProgrammes', { count: enrolments.length })}</h2>
          <div className="space-y-2">
            {enrolments.map((e: Enrolment) => {
              const eCourse = e.batch?.course;
              const eDay = e.batch?.start_date ? calculateDayNumber(e.batch.start_date, organisation.timezone) : 1;
              const status = programmeRunStatus(eCourse, eDay);
              const selected = e.id === enrolment.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => selectEnrolment(e.id)}
                  aria-pressed={selected}
                  className={`w-full min-h-14 p-3 rounded-2xl text-start flex items-center justify-between gap-2 transition-colors cursor-pointer ring-1 ${
                    selected ? 'ring-2 ring-emerald-600 bg-emerald-50' : 'ring-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-base font-semibold text-stone-900 truncate user-text">{eCourse?.name || t('common.programme')}</span>
                    <span className="block text-sm text-stone-600 truncate user-text">{e.batch?.name}</span>
                  </span>
                  <span className="shrink-0 flex flex-col items-end gap-1">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        status === 'running'
                          ? 'bg-emerald-100 text-emerald-800'
                          : status === 'upcoming'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {statusLabel(status)}
                    </span>
                    {hasPracticeTrack(eCourse) && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 user-text">
                        <Flame className="w-3.5 h-3.5" />
                        {practiceTrackName(eCourse)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!practice ? (
        /* Programme without a daily practice track (e.g. Art of Silence, VTP) */
        <section className="ui-card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-stone-950">{t('home.whatNext')}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">{statusLabel(runStatus)}</span>
          </div>
          {course?.description && <p className="text-base text-stone-700 leading-relaxed user-text">{course.description}</p>}
          <p className="text-base text-stone-700 leading-relaxed">
            {runStatus === 'upcoming'
              ? t('home.nextUpcoming', { date: startText })
              : runStatus === 'running'
              ? t('home.nextRunning')
              : t('home.nextFinished')}
          </p>
          {course?.programme_days ? <p className="text-sm text-stone-600">{t('home.length', { days: course.programme_days })}</p> : null}
        </section>
      ) : (
        batch &&
        profile && (
          <PracticeCheckin
            key={batch.id}
            orgId={organisation.id}
            batchId={batch.id}
            studentId={profile.id}
            startDate={batch.start_date}
            timeZone={organisation.timezone}
            todayDay={todayDayNumber}
            durationDays={durationDays}
            practiceName={practiceTrackName(course)}
            question={organisation.checkin_question}
            checkins={checkins}
            onCheckinsChange={setCheckins}
            loadError={checkinsError}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        )
      )}

      {/* Daily practice reminders on this phone (Phase 18), while the practice runs */}
      {practice && runStatus === 'running' && <RemindersCard compact />}

      {/* Reminders and follow-up sessions of the selected programme (Phase 7) */}
      {course && batch && (
        <ProgrammeFollowups
          key={`fu-${batch.id}`}
          batchId={batch.id}
          courseId={course.id}
          dayNumber={todayDayNumber}
          timeZone={organisation.timezone}
        />
      )}

      {/* Learning modules of the selected programme (Phase 6) */}
      {course && <ProgrammeLearning key={course.id} course={course} dayNumber={todayDayNumber} />}

      {/* Study materials of the programme (Phase 12) */}
      {course && <ProgrammeMaterials key={`mat-${course.id}`} course={course} />}

      <section className="ui-card">{joinForm('join-another', t('join.another'))}</section>
    </div>
  );
};
