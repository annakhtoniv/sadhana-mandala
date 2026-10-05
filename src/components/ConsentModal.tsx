import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, UserCheck, CalendarCheck, Clock, Check, LogOut } from 'lucide-react';

export const ConsentModal: React.FC = () => {
  const { giveConsent, signOut, organisation } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const handleConsent = async () => {
    setSubmitting(true);
    try {
      await giveConsent();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-stone-100 dark:border-stone-800/80 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-50 tracking-tight">
            Privacy & Practice Consent
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Welcome to {organisation.app_name}. Please review how your practice data is stored and shared.
          </p>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
          <div className="bg-stone-50 dark:bg-stone-800/50 p-4 rounded-2xl border border-stone-200/70 dark:border-stone-800 space-y-3">
            <div className="font-medium text-stone-900 dark:text-stone-100 text-sm">
              What we store:
            </div>

            <div className="flex items-start gap-3">
              <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-stone-800 dark:text-stone-200">Identity:</span>{' '}
                Your full name and Google email address.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CalendarCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-stone-800 dark:text-stone-200">Daily Answers:</span>{' '}
                Your daily check-in responses (Done, Not yet, or Rest day).
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-stone-800 dark:text-stone-200">Timestamps:</span>{' '}
                The exact date and time of each check-in to track your streak.
              </div>
            </div>
          </div>

          <div className="bg-amber-50/80 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs">
            <span className="font-semibold">Teacher Visibility:</span> Your course teacher can view your practice check-ins, current streak, and engagement to help support your commitment and notice if you have gone quiet.
          </div>

          <p className="text-[11px] text-stone-500 dark:text-stone-400">
            You can permanently delete your account, practice history, and all stored data at any time from your Profile screen.
          </p>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 space-y-3">
          <button
            type="button"
            onClick={handleConsent}
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 font-medium text-sm flex items-center justify-center gap-2 shadow hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{submitting ? 'Recording consent...' : 'I Understand & Consent'}</span>
          </button>

          <button
            type="button"
            onClick={signOut}
            className="w-full py-2 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cancel and Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
