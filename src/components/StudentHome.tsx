import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Check, X, Moon, Flame, Users, ArrowRight, BookOpen } from 'lucide-react';

interface StudentHomeProps {
  onNavigateLessons?: () => void;
}

export const StudentHome: React.FC<StudentHomeProps> = ({ onNavigateLessons }) => {
  const { organisation, profile } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [activeCheckin, setActiveCheckin] = useState<'done' | 'not_yet' | 'rest' | null>(null);

  // Student batch status (in Phase 1 default is no batch until enrolled)
  const isEnrolledInBatch = false;

  const handleCheckin = (status: 'done' | 'not_yet' | 'rest') => {
    // Phase 1 preview: updates active check-in state
    // Phase 3 will persist to Supabase checkins table
    setActiveCheckin(status);
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Greeting Card */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2">
        <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
          Daily Commitment
        </div>
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          Welcome, {profile?.full_name || 'Practitioner'}
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Timezone: {organisation.timezone}
        </p>
      </div>

      {/* No Batch Panel (per SPEC.md: "A user with no batch can still sign in. They see general lessons and a 'You are not in a batch yet' panel with a join code field. Nothing else.") */}
      {!isEnrolledInBatch && (
        <div className="bg-amber-50/70 dark:bg-amber-950/30 p-5 rounded-2xl border border-amber-200/70 dark:border-amber-900/60 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                You are not in a batch yet
              </h2>
              <p className="text-xs text-amber-700/90 dark:text-amber-400/90 leading-relaxed">
                If your teacher gave you a 6-character join code, enter it below to join your batch and begin your 40-day practice trail.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert(`Batch joining with code "${joinCode.toUpperCase()}" will be active in Phase 2.`);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              placeholder="e.g. DHARMA"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={10}
              className="flex-1 px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            <button
              type="submit"
              disabled={!joinCode.trim()}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <span>Join</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {onNavigateLessons && (
            <button
              type="button"
              onClick={onNavigateLessons}
              className="w-full py-2 px-3 text-xs text-amber-800 dark:text-amber-300 hover:underline flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Browse General Lessons</span>
            </button>
          )}
        </div>
      )}

      {/* Today's Question Card (from organisation.checkin_question) */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-5">
        <div className="space-y-1.5 text-center">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
            Day 1 of 40
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

      {/* Streak and Practice Trail Preview (Rows of 7) */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Current Streak
            </span>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            {activeCheckin === 'done' ? '1 Day' : '0 Days'}
          </span>
        </div>

        {/* Trail of 40 days in rows of seven */}
        <div className="space-y-2">
          <div className="text-[11px] text-stone-500 dark:text-stone-400">
            40-Day Practice Trail (rows of 7):
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 40 }).map((_, idx) => {
              const dayNum = idx + 1;
              const isToday = dayNum === 1;
              return (
                <div
                  key={dayNum}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[10px] font-medium border transition-colors ${
                    isToday
                      ? activeCheckin === 'done'
                        ? 'bg-emerald-500 text-white border-emerald-600 font-bold'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                      : 'bg-stone-100/80 dark:bg-stone-800/40 text-stone-400 border-stone-200/50 dark:border-stone-800/50'
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
