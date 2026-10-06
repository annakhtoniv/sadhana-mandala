import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { calculateDayNumber, formatDateDisplay } from '../lib/dateUtils';
import {
  fetchStudentCheckins,
  recordCheckin,
  calculateStreak,
} from '../lib/checkinService';
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
  Lock,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface StudentHomeProps {
  onNavigateLessons?: () => void;
}

export const StudentHome: React.FC<StudentHomeProps> = ({ onNavigateLessons }) => {
  const { organisation, profile, enrolment, joinBatch } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Checkins state
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const batch = enrolment?.batch;
  const course = batch?.course;
  const durationDays = course?.duration_days || 40;

  // Calculate today's day number in the organisation's timezone
  const todayDayNumber = batch?.start_date
    ? calculateDayNumber(batch.start_date, organisation.timezone)
    : 1;

  // Selected day for viewing / marking check-in.
  // Defaults to today (bounded between 1 and durationDays).
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    return Math.min(Math.max(todayDayNumber, 1), durationDays);
  });

  // Keep selectedDay updated when todayDayNumber initializes
  useEffect(() => {
    if (todayDayNumber >= 1 && todayDayNumber <= durationDays) {
      setSelectedDay(todayDayNumber);
    }
  }, [todayDayNumber, durationDays]);

  // Load student check-ins when enrolment or profile changes
  useEffect(() => {
    if (!batch?.id || !profile?.id) return;

    let isMounted = true;

    fetchStudentCheckins(batch.id, profile.id).then((data) => {
      if (isMounted) {
        setCheckins(data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [batch?.id, profile?.id]);

  // Map of day_number -> Checkin
  const checkinsByDay = React.useMemo(() => {
    const map = new Map<number, Checkin>();
    for (const c of checkins) {
      map.set(c.day_number, c);
    }
    return map;
  }, [checkins]);

  // Streak calculated using official business rules
  const currentStreak = React.useMemo(() => {
    return calculateStreak(checkins, todayDayNumber);
  }, [checkins, todayDayNumber]);

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

  // Handle recording check-in for the selected day
  const handleCheckin = async (status: CheckinStatus) => {
    if (!batch?.id || !profile?.id || savingCheckin) return;

    // Enforce business rule: only allow marking today or past dates! Future days cannot be marked.
    if (selectedDay > todayDayNumber) {
      setSaveFeedback('Future days cannot be marked in advance.');
      return;
    }

    setSavingCheckin(true);
    setSaveFeedback(null);

    // Optimistically update local check-in state
    const existingIndex = checkins.findIndex((c) => c.day_number === selectedDay);
    const optimisticCheckin: Checkin = {
      id: existingIndex >= 0 ? checkins[existingIndex].id : 'temp-id',
      org_id: organisation.id,
      batch_id: batch.id,
      student_id: profile.id,
      day_number: selectedDay,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const nextCheckins = [...checkins];
    if (existingIndex >= 0) {
      nextCheckins[existingIndex] = optimisticCheckin;
    } else {
      nextCheckins.push(optimisticCheckin);
    }
    setCheckins(nextCheckins);

    // Persist to Supabase with upsert
    const res = await recordCheckin(
      organisation.id,
      batch.id,
      profile.id,
      selectedDay,
      status
    );

    if (res.success && res.checkin) {
      // Replace with confirmed database record
      setCheckins((prev) => {
        const filtered = prev.filter((c) => c.day_number !== selectedDay);
        return [...filtered, res.checkin!].sort((a, b) => a.day_number - b.day_number);
      });
      setSaveFeedback(
        selectedDay === todayDayNumber
          ? `Recorded for today (Day ${selectedDay}): ${status.replace('_', ' ')}`
          : `Updated Day ${selectedDay} (past date): ${status.replace('_', ' ')}`
      );
      // Notify guided tour fluency engine
      window.dispatchEvent(new CustomEvent('sadhana_action_checkin', { detail: { day: selectedDay, status } }));
    } else {
      setSaveFeedback(`Failed to save: ${res.error || 'Please try again'}`);
    }

    setSavingCheckin(false);
  };

  // Selected day's recorded checkin
  const selectedDayCheckin = checkinsByDay.get(selectedDay);
  const selectedDayStatus = selectedDayCheckin?.status || null;

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

          {/* Quick Demo Batch 1-Click Join Section */}
          <div className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2.5">
            <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>1-Click Demo Cohort Join</span>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setJoinCode('AUTUMN23');
                  joinBatch('AUTUMN23');
                }}
                disabled={joining}
                className="w-full p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800 text-left transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
                    Autumn Awakening Cohort (Active at Day 23)
                  </div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                    40-day course &bull; 30 students &bull; Rich check-in trail
                  </div>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-stone-900 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 shadow-sm">
                  <span>AUTUMN23</span>
                  <ArrowRight className="w-3 h-3 text-emerald-600" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setJoinCode('SADH40');
                  joinBatch('SADH40');
                }}
                disabled={joining}
                className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/80 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 text-left transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-medium text-stone-800 dark:text-stone-200">
                    October Sadhana Cohort (Fresh Day 1)
                  </div>
                  <div className="text-[10px] text-stone-400">
                    Starts today at Day 1
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-stone-600 dark:text-stone-400 bg-white dark:bg-stone-900 px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700">
                  SADH40
                </span>
              </button>
            </div>
          </div>

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

      {/* Check-in Question Card */}
      <div id="tour-checkin-card" className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-5">
        <div className="space-y-1.5 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <Calendar className="w-3 h-3" />
              <span>
                {selectedDay === todayDayNumber
                  ? `Day ${selectedDay} of ${durationDays} (Today)`
                  : selectedDay < todayDayNumber
                  ? `Day ${selectedDay} of ${durationDays} (Past Date)`
                  : `Day ${selectedDay} of ${durationDays} (Future Day)`}
              </span>
            </span>
          </div>

          <h2 className="text-base font-medium text-stone-900 dark:text-stone-100 leading-snug pt-1">
            {selectedDay === todayDayNumber
              ? organisation.checkin_question
              : `Did you complete your practice on Day ${selectedDay}?`}
          </h2>

          {selectedDay !== todayDayNumber && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setSelectedDay(todayDayNumber)}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
              >
                <span>Jump back to Today (Day {todayDayNumber})</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* 3 Option Buttons (Done, Not yet, Rest day) */}
        {selectedDay > todayDayNumber ? (
          /* Future Day Notice */
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Future Day Locked</span>
            </div>
            <p className="text-[11px] text-stone-400">
              This day has not arrived yet. You can check in once Day {selectedDay} begins.
            </p>
          </div>
        ) : (
          /* Active / Past Check-in Buttons */
          <div className="space-y-3">
            <div id="tour-checkin-buttons" className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleCheckin('done')}
                disabled={savingCheckin}
                className={`p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all cursor-pointer disabled:opacity-50 ${
                  selectedDayStatus === 'done'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-[1.02]'
                    : 'bg-stone-50 dark:bg-stone-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700/80 active:scale-95'
                }`}
              >
                <Check className="w-5 h-5" />
                <span className="text-xs font-semibold">Done</span>
              </button>

              <button
                type="button"
                onClick={() => handleCheckin('not_yet')}
                disabled={savingCheckin}
                className={`p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all cursor-pointer disabled:opacity-50 ${
                  selectedDayStatus === 'not_yet'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md scale-[1.02]'
                    : 'bg-stone-50 dark:bg-stone-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700/80 active:scale-95'
                }`}
              >
                <X className="w-5 h-5" />
                <span className="text-xs font-semibold">Not yet</span>
              </button>

              <button
                type="button"
                onClick={() => handleCheckin('rest')}
                disabled={savingCheckin}
                className={`p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all cursor-pointer disabled:opacity-50 ${
                  selectedDayStatus === 'rest'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]'
                    : 'bg-stone-50 dark:bg-stone-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700/80 active:scale-95'
                }`}
              >
                <Moon className="w-5 h-5" />
                <span className="text-xs font-semibold">Rest day</span>
              </button>
            </div>

            {/* Status Feedback */}
            <div className="min-h-[20px] text-center">
              {savingCheckin ? (
                <div className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to database...</span>
                </div>
              ) : selectedDayStatus ? (
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Recorded for Day {selectedDay}:{' '}
                  <strong className="capitalize text-stone-800 dark:text-stone-200">
                    {selectedDayStatus.replace('_', ' ')}
                  </strong>
                  . Tapping again updates the answer.
                </p>
              ) : (
                <p className="text-[11px] text-stone-400 italic">
                  No answer recorded yet for Day {selectedDay}. Tap an option above.
                </p>
              )}
            </div>
          </div>
        )}

        {saveFeedback && !savingCheckin && (
          <div className="p-2.5 bg-stone-100 dark:bg-stone-800 rounded-xl text-center text-xs text-stone-600 dark:text-stone-300 animate-in fade-in">
            {saveFeedback}
          </div>
        )}
      </div>

      {/* Streak and Practice Trail (Rows of 7 for duration_days) */}
      <div id="tour-streak-card" className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center border border-amber-200/60 dark:border-amber-900/60">
              <Flame className="w-4 h-4 fill-amber-500" />
            </div>
            <div>
              <span className="text-sm font-semibold text-stone-900 dark:text-stone-100 block">
                Practice Streak
              </span>
              <span className="text-[10px] text-stone-400">
                Consecutive practice days
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{currentStreak} {currentStreak === 1 ? 'Day' : 'Days'}</span>
            </span>
          </div>
        </div>

        {/* Trail in rows of seven using duration_days (per SPEC) */}
        <div id="tour-practice-trail" className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
            <span>{durationDays}-Day Practice Trail (rows of 7):</span>
            <span className="text-[10px] text-stone-400">Tap past days to edit</span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: durationDays }).map((_, idx) => {
              const dayNum = idx + 1;
              const isToday = dayNum === todayDayNumber;
              const isFuture = dayNum > todayDayNumber;
              const isSelected = dayNum === selectedDay;

              const checkinRecord = checkinsByDay.get(dayNum);
              const status = checkinRecord?.status;

              // Tile Styling
              let bgClass = '';
              let textClass = '';
              let borderClass = '';

              if (isFuture) {
                // Future days: visible but greyed out / locked
                bgClass = 'bg-stone-100/50 dark:bg-stone-900/40 opacity-40';
                textClass = 'text-stone-400 dark:text-stone-600';
                borderClass = 'border-stone-200/40 dark:border-stone-800/40 border-dashed';
              } else if (status === 'done') {
                bgClass = 'bg-emerald-600 dark:bg-emerald-600';
                textClass = 'text-white font-bold';
                borderClass = 'border-emerald-700';
              } else if (status === 'rest') {
                bgClass = 'bg-indigo-600 dark:bg-indigo-600';
                textClass = 'text-white font-bold';
                borderClass = 'border-indigo-700';
              } else if (status === 'not_yet') {
                bgClass = 'bg-amber-500 dark:bg-amber-600';
                textClass = 'text-white font-bold';
                borderClass = 'border-amber-600';
              } else if (isToday) {
                // Today with no answer yet
                bgClass = 'bg-emerald-50 dark:bg-emerald-950/60';
                textClass = 'text-emerald-700 dark:text-emerald-300 font-bold';
                borderClass = 'border-emerald-400 dark:border-emerald-600';
              } else {
                // Past day missed (no answer)
                bgClass = 'bg-stone-100 dark:bg-stone-800/70';
                textClass = 'text-stone-500 dark:text-stone-400';
                borderClass = 'border-stone-300 dark:border-stone-700';
              }

              return (
                <button
                  key={dayNum}
                  type="button"
                  disabled={isFuture}
                  onClick={() => {
                    setSelectedDay(dayNum);
                    window.dispatchEvent(new CustomEvent('sadhana_action_trailday', { detail: { dayNum } }));
                  }}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[10px] border transition-all cursor-pointer relative ${bgClass} ${textClass} ${borderClass} ${
                    isSelected ? 'ring-2 ring-stone-900 dark:ring-stone-100 ring-offset-2 dark:ring-offset-stone-950 scale-105 z-10' : ''
                  } ${isFuture ? 'cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                  title={
                    isFuture
                      ? `Day ${dayNum} (Future - locked)`
                      : isToday
                      ? `Day ${dayNum} (Today)`
                      : `Day ${dayNum} (Past - click to edit)`
                  }
                >
                  {isFuture ? (
                    <div className="flex flex-col items-center justify-center">
                      <Lock className="w-2.5 h-2.5 mb-0.5 text-stone-400" />
                      <span className="text-[9px]">{dayNum}</span>
                    </div>
                  ) : status === 'done' ? (
                    <div className="flex flex-col items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span className="text-[9px] leading-none">{dayNum}</span>
                    </div>
                  ) : status === 'rest' ? (
                    <div className="flex flex-col items-center justify-center">
                      <Moon className="w-3 h-3" />
                      <span className="text-[9px] leading-none">{dayNum}</span>
                    </div>
                  ) : status === 'not_yet' ? (
                    <div className="flex flex-col items-center justify-center">
                      <X className="w-3 h-3 stroke-[3]" />
                      <span className="text-[9px] leading-none">{dayNum}</span>
                    </div>
                  ) : (
                    <span>{dayNum}</span>
                  )}

                  {/* Indicator dot for today */}
                  {isToday && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-stone-900" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-[10px] text-stone-500 dark:text-stone-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-md bg-emerald-600 inline-block" />
              <span>Done</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-md bg-indigo-600 inline-block" />
              <span>Rest day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-md bg-amber-500 inline-block" />
              <span>Not yet</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-md bg-stone-200 dark:bg-stone-700 inline-block" />
              <span>Missed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-md border border-stone-300 dark:border-stone-700 opacity-40 inline-block" />
              <span>Future</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
