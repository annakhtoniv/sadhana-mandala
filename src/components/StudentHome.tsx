import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/errors';
import { flushTicks, pendingTicks, type PendingTick } from '../lib/offlineTicks';
import { ProgrammeLearning } from './ProgrammeLearning';
import { ProgrammeMaterials } from './ProgrammeMaterials';
import { ProgrammeFollowups } from './ProgrammeFollowups';
import { PracticeCheckin } from './PracticeCheckin';
import { calculateDayNumber, formatDateDisplay } from '../lib/dateUtils';
import {
  fetchStudentCheckins,
} from '../lib/checkinService';
import {
  hasPracticeTrack,
  practiceTrackName,
  programmeRunStatus,
  RUN_STATUS_LABEL,
} from '../lib/programmeUtils';
import type { Checkin, Enrolment } from '../types/database';
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
    if (!joinCode.trim()) return;

    setJoining(true);
    setJoinError(null);

    const result = await joinBatch(joinCode);
    if (!result.success) {
      setJoinError(result.message || 'Invalid join code. Please check with your teacher.');
    } else {
      setJoinCode('');
    }
    setJoining(false);
  };

  // Un-enrolled View
  if (!enrolment) {
    return (
      <div className="w-full space-y-6 animate-in fade-in duration-150">
        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-1">
          <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
            Welcome to {organisation.app_name}
          </div>
          <h1 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            {profile?.full_name || 'Practitioner'}
          </h1>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 shadow-sm space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-900/60">
              <Users className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                You are not in a batch yet
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                If your teacher gave you a 6-character join code, enter it below to join your batch and begin your daily practice trail.
              </p>
            </div>
          </div>

          <form onSubmit={handleJoinByCode} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. AUTUMN23"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={10}
                required
                className="flex-1 px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-stone-500"
              />
              <button
                type="submit"
                disabled={joining || !joinCode.trim()}
                className="px-5 py-3 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold flex items-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Join</span>}
                {!joining && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            {joinError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{joinError}</span>
              </div>
            )}
          </form>


          {onNavigateLessons && (
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={onNavigateLessons}
                className="w-full py-2.5 px-3 text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-stone-400" />
                <span>Explore General Lessons</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active Enrolled View
  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Batch Header */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
            {course?.name || 'Sadhana Commitment'}
          </span>
          <span className="text-[11px] text-stone-400 font-mono">
            {batch?.start_date ? formatDateDisplay(batch.start_date, organisation.timezone) : ''}
          </span>
        </div>
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          {batch?.name}
        </h1>
        {batch?.teacher && (
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Teacher: {batch.teacher.full_name || batch.teacher.email}
          </p>
        )}
      </div>

      {/* My programmes (a student can be in many programmes over time) */}
      {enrolments.length > 1 && (
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            My programmes ({enrolments.length})
          </div>
          <div className="space-y-1.5">
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
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    selected
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                      : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                      {eCourse?.name || 'Programme'}
                    </div>
                    <div className="text-[11px] text-stone-500 truncate">{e.batch?.name}</div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        status === 'running'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : status === 'upcoming'
                          ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
                      }`}
                    >
                      {RUN_STATUS_LABEL[status]}
                    </span>
                    {hasPracticeTrack(eCourse) && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                        <Flame className="w-3 h-3" />
                        {practiceTrackName(eCourse)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!practice ? (
        /* Programme without a daily practice track (e.g. Art of Silence, VTP) */
        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              About this programme
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
              {RUN_STATUS_LABEL[programmeRunStatus(course, todayDayNumber)]}
            </span>
          </div>
          {course?.description && (
            <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{course.description}</p>
          )}
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-stone-400">Started</dt>
              <dd className="font-medium text-stone-800 dark:text-stone-200">
                {batch?.start_date ? formatDateDisplay(batch.start_date, organisation.timezone) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-stone-400">Length</dt>
              <dd className="font-medium text-stone-800 dark:text-stone-200">
                {course?.programme_days ? `${course.programme_days} days` : 'Not set'}
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-stone-400">
            This programme has no daily check-in.
          </p>
        </div>
      ) : (
      <>
      {batch && profile && (
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
      )}
      </>
      )}

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

      {/* Join another programme with its join code */}
      <form
        onSubmit={handleJoinByCode}
        className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2"
      >
        <label htmlFor="join-another" className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
          Joining another programme?
        </label>
        <div className="flex gap-2">
          <input
            id="join-another"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Join code"
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm font-mono tracking-widest text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-500"
          />
          <button
            type="submit"
            disabled={joining || !joinCode.trim()}
            className="px-4 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold disabled:opacity-50"
          >
            {joining ? 'Joining...' : 'Join'}
          </button>
        </div>
        {joinError && <p className="text-xs text-red-600 dark:text-red-400">{joinError}</p>}
      </form>
    </div>
  );
};
