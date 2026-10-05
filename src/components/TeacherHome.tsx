import React from 'react';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Users, PlusCircle, Sparkles } from 'lucide-react';

export const TeacherHome: React.FC = () => {
  const { organisation, profile } = useAuth();

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Header card */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <GraduationCap className="w-4 h-4" />
          <span>Teacher Dashboard &bull; {organisation.app_name}</span>
        </div>
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          Welcome, {profile?.full_name || 'Teacher'}
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Oversee your student batches, daily practice check-ins, and student quiet alerts.
        </p>
      </div>

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 text-center">
          <div className="text-xs text-stone-400">My Batches</div>
          <div className="text-lg font-bold text-stone-800 dark:text-stone-100 mt-1">0</div>
        </div>
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 text-center">
          <div className="text-xs text-stone-400">Practising Today</div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">0</div>
        </div>
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 text-center">
          <div className="text-xs text-stone-400">Quiet (4+ days)</div>
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">0</div>
        </div>
      </div>

      {/* My Batches Section */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            My Batches
          </h2>
          <button
            type="button"
            onClick={() => alert('Batch creation and management will be enabled in Phase 2.')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create Batch</span>
          </button>
        </div>

        {/* Empty state for Phase 1 */}
        <div className="p-8 text-center rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-dashed border-stone-200 dark:border-stone-700/80 space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">
              No batches created yet
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 max-w-xs mx-auto">
              In Phase 2, you can create batches, invite students by pasting email lists, and share unique join codes and QR codes.
            </p>
          </div>
        </div>
      </div>

      {/* Teacher Capabilities Reminder */}
      <div className="bg-stone-100/70 dark:bg-stone-800/30 p-4 rounded-xl border border-stone-200/60 dark:border-stone-800/60 text-xs text-stone-600 dark:text-stone-400 space-y-2">
        <div className="font-medium text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Role Rule: Teacher Isolation</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          Enforced by Row Level Security: Teachers have full control of their own batches, student rosters, invites, and batch lessons, and can only read check-ins of students enrolled in their own batches.
        </p>
      </div>
    </div>
  );
};
