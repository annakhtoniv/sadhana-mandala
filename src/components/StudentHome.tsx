import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { calculateDayNumber, formatDateDisplay } from '../lib/dateUtils';
import { Check, X, Moon, Flame, Users, ArrowRight, BookOpen, AlertCircle, Loader2 } from 'lucide-react';

interface StudentHomeProps {
  onNavigateLessons?: () => void;
}

export const StudentHome: React.FC<StudentHomeProps> = ({ onNavigateLessons }) => {
  const { organisation, profile, enrolment, joinBatch } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [activeCheckin, setActiveCheckin] = useState<'done' | 'not_yet' | 'rest' | null>(null);

  const batch = enrolment?.batch;
  const course = batch?.course;
  const durationDays = course?.duration_days || 40;

  // Calculate day number in the organisation's timezone
  const currentDay = batch?.start_date
    ? calculateDayNumber(batch.start_date, organisation.timezone)
    : 1;

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

  const handleCheckin = (status: 'done' | 'not_yet' | 'rest') => {
    setActiveCheckin(status);
  };

  // If student has NO batch enrolment yet (Per SPEC.md: "A user with no batch can still sign in. They see general lessons and a 'You are not in a batch yet' panel with a join code field. Nothing else.")
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
            {currentDay < 1
              ? `Starts in ${Math.abs(currentDay - 1)} days`
              : currentDay <= durationDays
              ? `Day ${currentDay} of ${durationDays}`
              : `Course Finished (Day ${durationDays} of ${durationDays})`}
          </span>
          <h2 className="text-base font-medium text-stone-900 dark:text-stone-100 leading-snug">
            {organisation.checkin_question}
          </h2>
        </div>

        {/* 3 Option Buttons (Done, Not yet, Rest day) */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => handleCheckin('done')}
            className={`p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all cursor-pointer ${
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
            onClick={() => handleCheckin('not_yet')}
            className={`p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all cursor-pointer ${
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
            onClick={() => handleCheckin('rest')}
            className={`p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all cursor-pointer ${
              activeCheckin === 'rest'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]'
                : 'bg-stone-50 dark:bg-stone-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700/80'
            }`}
          >
            <Moon className="w-5 h-5" />
            <span className="text-xs font-semibold">Rest day</span>
          </button>
        </div>

        {activeCheckin && (
          <p className="text-[11px] text-center text-stone-500 dark:text-stone-400">
            Recorded for today: <strong className="capitalize">{activeCheckin.replace('_', ' ')}</strong>. You can change your answer anytime today.
          </p>
        )}
      </div>

      {/* Streak and Practice Trail (Rows of 7 for duration_days) */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Practice Streak
            </span>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            {activeCheckin === 'done' ? '1 Day' : '0 Days'}
          </span>
        </div>

        {/* Trail in rows of seven using duration_days (per SPEC) */}
        <div className="space-y-2">
          <div className="text-[11px] text-stone-500 dark:text-stone-400">
            {durationDays}-Day Practice Trail (rows of 7):
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: durationDays }).map((_, idx) => {
              const dayNum = idx + 1;
              const isToday = dayNum === currentDay;
              const isPast = dayNum < currentDay;

              return (
                <div
                  key={dayNum}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[10px] font-medium border transition-colors ${
                    isToday
                      ? activeCheckin === 'done'
                        ? 'bg-emerald-500 text-white border-emerald-600 font-bold shadow-sm'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-400 dark:border-emerald-600 font-bold ring-2 ring-emerald-500/20'
                      : isPast
                      ? 'bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                      : 'bg-stone-50/70 dark:bg-stone-800/30 text-stone-400 border-stone-200/50 dark:border-stone-800/50'
                  }`}
                  title={`Day ${dayNum}`}
                >
                  <span>{dayNum}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
