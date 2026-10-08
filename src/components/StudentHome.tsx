import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { calculateDayNumber, formatDateDisplay } from '../lib/dateUtils';
import { calculateStreak, getTrailDayStatus, upsertCheckinInMemory } from '../lib/practiceUtils';
import { fetchStudentBatchCheckins, saveDailyCheckin } from '../lib/checkinService';
import type { Checkin, CheckinStatus } from '../types/database';
import {
  Check,
  X,
  Moon,
  Flame,
  Users,
  ArrowRight,
  BookOpen,
  AlertCircle,
  Loader2,
  Calendar,
  Sparkles,
  Minus,
  CheckCircle2,
} from 'lucide-react';

interface StudentHomeProps {
  onNavigateLessons?: () => void;
}

export const StudentHome: React.FC<StudentHomeProps> = ({ onNavigateLessons }) => {
  const { organisation, profile, enrolment, joinBatch } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Check-in database state
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loadingCheckins, setLoadingCheckins] = useState(false);
  const [isSavingCheckin, setIsSavingCheckin] = useState(false);
  const [checkinFeedback, setCheckinFeedback] = useState<string | null>(null);

  const batch = enrolment?.batch;
  const course = batch?.course;
  const durationDays = course?.duration_days || 40;

  // Calculate day number in the organisation's timezone
  const currentDay = batch?.start_date
    ? calculateDayNumber(batch.start_date, organisation.timezone)
    : 1;

  // Fetch check-in history from Supabase when enrolment loads
  useEffect(() => {
    if (!enrolment?.batch_id || !profile?.id) return;
    let isCancelled = false;

    const loadCheckins = async () => {
      setLoadingCheckins(true);
      const data = await fetchStudentBatchCheckins(enrolment.batch_id, profile.id);
      if (!isCancelled) {
        setCheckins(data);
        setLoadingCheckins(false);
      }
    };

    loadCheckins();

    return () => {
      isCancelled = true;
    };
  }, [enrolment?.batch_id, profile?.id]);

  // Derive today's checkin from database records
  const todayCheckin = checkins.find((c) => c.day_number === currentDay);
  const activeCheckin = todayCheckin?.status || null;

  // Calculate live streak
  const currentStreak = calculateStreak(checkins, currentDay);

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

  /**
   * Records or updates daily checkin.
   * Per SPEC:
   * - Students can check in for today only.
   * - Tapping twice or changing answer updates the row for today, never duplicates it.
   */
  const handleCheckin = async (status: CheckinStatus) => {
    if (!enrolment?.batch_id || !profile?.id) return;

    // Students can check in for today only, during active batch window
    if (currentDay < 1) {
      setCheckinFeedback('This batch has not started yet. Check-ins open on Day 1.');
      return;
    }
    if (currentDay > durationDays) {
      setCheckinFeedback('This course has concluded. Thank you for your practice!');
      return;
    }

    setIsSavingCheckin(true);
    setCheckinFeedback(null);

    // Optimistic UI update
    const optimisticRecord: Checkin = {
      id: todayCheckin?.id || 'temp-' + Date.now(),
      org_id: organisation.id,
      batch_id: enrolment.batch_id,
      student_id: profile.id,
      day_number: currentDay,
      status,
      created_at: todayCheckin?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setCheckins((prev) => upsertCheckinInMemory(prev, optimisticRecord));

    // Save to Supabase checkins table
    const result = await saveDailyCheckin({
      orgId: organisation.id,
      batchId: enrolment.batch_id,
      studentId: profile.id,
      dayNumber: currentDay,
      status,
    });

    if (result.success && result.data) {
      setCheckins((prev) => upsertCheckinInMemory(prev, result.data!));
      const statusLabel =
        status === 'done' ? 'Practice Done' : status === 'rest' ? 'Rest Day' : 'Not Yet';
      setCheckinFeedback(`Recorded for today (Day ${currentDay}): ${statusLabel}. You can change your answer anytime today.`);
    } else {
      // Revert / re-fetch on failure
      const reverted = await fetchStudentBatchCheckins(enrolment.batch_id, profile.id);
      setCheckins(reverted);
      setCheckinFeedback(result.error || 'Could not save check-in. Please try again.');
    }

    setIsSavingCheckin(false);
  };

  // If student has NO batch enrolment yet (Per SPEC.md)
  if (!enrolment) {
    return (
      <div className="w-full space-y-6 animate-in fade-in duration-150">
        {/* Welcome Banner */}
        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-1">
          <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
            Welcome to {organisation.app_name}
          </div>
          <h1 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            {profile?.full_name || 'Practitioner'}
          </h1>
        </div>

        {/* You are not in a batch yet Panel */}
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
                placeholder="e.g. DHAR40"
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

  // Active Batch View
  const isFutureBatch = currentDay < 1;
  const isFinishedBatch = currentDay > durationDays;
  const canCheckinToday = !isFutureBatch && !isFinishedBatch;

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

      {/* Today's Question Card */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-5">
        <div className="space-y-1.5 text-center">
          <span className="text-xs font-semibold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
            {isFutureBatch
              ? `Starts in ${Math.abs(currentDay - 1)} days`
              : !isFinishedBatch
              ? `Day ${currentDay} of ${durationDays}`
              : `Course Finished (Day ${durationDays} of ${durationDays})`}
          </span>
          <h2 className="text-base font-medium text-stone-900 dark:text-stone-100 leading-snug">
            {organisation.checkin_question}
          </h2>
        </div>

        {/* Status notice when batch is before start or finished */}
        {isFutureBatch && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-700 dark:text-amber-300 text-center flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Check-in opens on Day 1 ({formatDateDisplay(batch?.start_date || '', organisation.timezone)}).</span>
          </div>
        )}

        {isFinishedBatch && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-700 dark:text-emerald-300 text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Congratulations! All {durationDays} days of practice have finished.</span>
          </div>
        )}

        {/* 3 Option Buttons (Done, Not yet, Rest day) */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            disabled={!canCheckinToday || isSavingCheckin}
            onClick={() => handleCheckin('done')}
            className={`p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              activeCheckin === 'done'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-[1.02]'
                : 'bg-stone-50 dark:bg-stone-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700/80'
            }`}
          >
            <Check className="w-5 h-5" />
            <span className="text-xs font-semibold">Done</span>
          </button>

          <button
            type="button"
            disabled={!canCheckinToday || isSavingCheckin}
            onClick={() => handleCheckin('not_yet')}
            className={`p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              activeCheckin === 'not_yet'
                ? 'bg-amber-600 text-white border-amber-600 shadow-md scale-[1.02]'
                : 'bg-stone-50 dark:bg-stone-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700/80'
            }`}
          >
            <X className="w-5 h-5" />
            <span className="text-xs font-semibold">Not yet</span>
          </button>

          <button
            type="button"
            disabled={!canCheckinToday || isSavingCheckin}
            onClick={() => handleCheckin('rest')}
            className={`p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              activeCheckin === 'rest'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]'
                : 'bg-stone-50 dark:bg-stone-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700/80'
            }`}
          >
            <Moon className="w-5 h-5" />
            <span className="text-xs font-semibold">Rest day</span>
          </button>
        </div>

        {/* Feedback text */}
        {checkinFeedback ? (
          <p className="text-[11px] text-center text-stone-500 dark:text-stone-400 animate-in fade-in">
            {checkinFeedback}
          </p>
        ) : activeCheckin ? (
          <p className="text-[11px] text-center text-stone-500 dark:text-stone-400">
            Recorded for today: <strong className="capitalize">{activeCheckin.replace('_', ' ')}</strong>. You can change your answer anytime today.
          </p>
        ) : canCheckinToday ? (
          <p className="text-[11px] text-center text-stone-400">
            Tap an option above to log your practice for today.
          </p>
        ) : null}
      </div>

      {/* Streak and Practice Trail (Rows of 7 for duration_days per SPEC) */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Practice Streak
            </span>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
            <span>{currentStreak} {currentStreak === 1 ? 'Day' : 'Days'}</span>
            {currentStreak > 0 && <Sparkles className="w-3 h-3 text-amber-500" />}
          </span>
        </div>

        {/* Trail in rows of seven using duration_days (per SPEC) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
            <span>{durationDays}-Day Practice Trail (rows of 7):</span>
            {loadingCheckins && (
              <span className="text-[10px] text-stone-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading...
              </span>
            )}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: durationDays }).map((_, idx) => {
              const dayNum = idx + 1;
              const checkinRecord = checkins.find((c) => c.day_number === dayNum);
              const status = getTrailDayStatus(dayNum, currentDay, checkinRecord?.status);

              let cellStyle = '';
              let icon = null;
              let tooltip = `Day ${dayNum}`;

              switch (status) {
                case 'done':
                  cellStyle = 'bg-emerald-600 text-white border-emerald-600 shadow-sm';
                  icon = <Check className="w-2.5 h-2.5 stroke-[3]" />;
                  tooltip = `Day ${dayNum}: Practice Completed`;
                  break;
                case 'rest':
                  cellStyle = 'bg-indigo-600 text-white border-indigo-600 shadow-sm';
                  icon = <Moon className="w-2.5 h-2.5" />;
                  tooltip = `Day ${dayNum}: Rest Day`;
                  break;
                case 'not_yet':
                  cellStyle = 'bg-amber-600 text-white border-amber-600 shadow-sm';
                  icon = <X className="w-2.5 h-2.5 stroke-[3]" />;
                  tooltip = `Day ${dayNum}: Not Yet`;
                  break;
                case 'missed':
                  cellStyle = 'bg-stone-100 dark:bg-stone-800/60 text-stone-400 dark:text-stone-500 border-dashed border-stone-300 dark:border-stone-700';
                  icon = <Minus className="w-2 h-2" />;
                  tooltip = `Day ${dayNum}: Missed / No Check-in`;
                  break;
                case 'today':
                  cellStyle = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-500 font-bold ring-2 ring-emerald-500/20';
                  tooltip = `Day ${dayNum}: Today (Pending Check-in)`;
                  break;
                case 'future':
                default:
                  cellStyle = 'bg-stone-50/70 dark:bg-stone-900/40 text-stone-400 dark:text-stone-600 border border-stone-200/50 dark:border-stone-800/50';
                  tooltip = `Day ${dayNum}: Upcoming`;
                  break;
              }

              return (
                <div
                  key={dayNum}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[10px] font-medium border transition-all ${cellStyle}`}
                  title={tooltip}
                >
                  <span className="leading-none">{dayNum}</span>
                  {icon && <span className="mt-0.5">{icon}</span>}
                </div>
              );
            })}
          </div>

          {/* Visual Legend */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-[10px] text-stone-500 dark:text-stone-400 border-t border-stone-100 dark:border-stone-800/80">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-emerald-600 inline-block shrink-0" />
              <span>Done</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-indigo-600 inline-block shrink-0" />
              <span>Rest day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-amber-600 inline-block shrink-0" />
              <span>Not yet</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-stone-100 dark:bg-stone-800 border border-dashed border-stone-300 dark:border-stone-700 inline-block shrink-0" />
              <span>Missed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 inline-block shrink-0" />
              <span>Today</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
