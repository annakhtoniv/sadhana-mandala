import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, CheckCircle2, AlertOctagon, LogOut, Trash2, ArrowLeft } from 'lucide-react';

interface ProfileScreenProps {
  onBack: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack }) => {
  const { profile, user, organisation, role, signOut, deleteAccount } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formattedConsentDate = profile?.consent_at
    ? new Date(profile.consent_at).toLocaleString('en-US', {
        timeZone: organisation.timezone || 'Asia/Dubai',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not yet recorded';

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to practice</span>
      </button>

      {/* Profile Card */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-700 dark:text-stone-300 font-semibold text-base border border-stone-200 dark:border-stone-700">
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              {profile?.full_name || 'Practitioner'}
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400">{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
            <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-semibold">
              Role
            </span>
            <span className="text-xs font-medium capitalize text-stone-800 dark:text-stone-200 mt-0.5 block">
              {role}
            </span>
          </div>

          <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
            <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-semibold">
              Organisation
            </span>
            <span className="text-xs font-medium text-stone-800 dark:text-stone-200 mt-0.5 block truncate">
              {organisation.name}
            </span>
          </div>
        </div>
      </div>

      {/* Consent & Privacy Status */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-900 dark:text-stone-100">
          <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Privacy & Consent Record</span>
        </div>

        <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-stone-700 dark:text-stone-300">Consent Provided:</span>
          </div>
          <span className="font-medium text-stone-900 dark:text-stone-100 text-[11px]">
            {formattedConsentDate}
          </span>
        </div>
        <p className="text-[11px] text-stone-400 dark:text-stone-500 leading-relaxed">
          Stored consent governs the collection of your daily practice responses and timestamps for teacher guidance in {organisation.timezone}.
        </p>
      </div>

      {/* Account Actions */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <button
          type="button"
          onClick={signOut}
          className="w-full py-3 px-4 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>

        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-3 px-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete My Account</span>
        </button>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-stone-900 rounded-3xl border border-red-200 dark:border-red-900/80 p-6 shadow-xl space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center">
              <AlertOctagon className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                Permanently delete account?
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                As required by the product brief, this will permanently remove your login account, profile, enrolments, and all daily check-in records for real. This action cannot be undone.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer shadow"
              >
                {isDeleting ? 'Deleting account...' : 'Yes, Delete Everything Permanently'}
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="w-full py-2.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
