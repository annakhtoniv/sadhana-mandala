import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { InstallAppCard } from './InstallAppCard';
import { Avatar } from './Avatar';
import { uploadAvatar, switchToGoogleAvatar } from '../lib/avatarService';
import { ROLE_LABEL } from '../lib/roles';
import { Camera, Loader2, Shield, CheckCircle2, AlertOctagon, LogOut, Trash2, ArrowLeft, Crown, GraduationCap } from 'lucide-react';

interface ProfileScreenProps {
  onBack: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack }) => {
  const { profile, user, organisation, role, setActiveRole, signOut, deleteAccount, refreshProfile } = useAuth();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const formattedConsentDate = profile?.consent_at
    ? new Date(profile.consent_at).toLocaleString('en-US', {
        timeZone: organisation.timezone || 'Asia/Dubai',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not yet recorded';

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    const res = await deleteAccount();
    setIsDeleting(false);
    // On success the person is signed out; otherwise say why it was not deleted
    if (!res.success) setDeleteError(res.error || 'Your account could not be deleted. Please try again.');
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
        <span>Back</span>
      </button>

      {/* Profile Card */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar name={profile?.full_name || user?.email} url={profile?.avatar_url} size={72} />
            <label
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center cursor-pointer shadow-lg ring-2 ring-white hover:scale-105 transition-transform"
              title="Change photo"
            >
              {photoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Change photo"
                disabled={photoBusy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file || !user) return;
                  setPhotoBusy(true);
                  setPhotoMessage(null);
                  const res = await uploadAvatar(user.id, file);
                  setPhotoBusy(false);
                  if (!res.success) setPhotoMessage(res.error || 'Upload failed.');
                  else await refreshProfile();
                }}
              />
            </label>
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-semibold text-stone-900 truncate">
              {profile?.full_name || 'Practitioner'}
            </h1>
            <p className="text-xs text-stone-500 truncate">{user?.email}</p>
            {profile?.avatar_source === 'upload' ? (
              <button
                type="button"
                disabled={photoBusy}
                onClick={async () => {
                  if (!user) return;
                  setPhotoBusy(true);
                  const res = await switchToGoogleAvatar(user.id);
                  setPhotoBusy(false);
                  if (!res.success) setPhotoMessage(res.error || 'Could not switch.');
                  else await refreshProfile();
                }}
                className="mt-1 text-[11px] text-stone-500 underline cursor-pointer"
              >
                Use my Google photo
              </button>
            ) : (
              <p className="mt-1 text-[11px] text-stone-400">Photo from your Google account. Tap the camera to change it.</p>
            )}
            {photoMessage && <p className="mt-1 text-[11px] text-red-600">{photoMessage}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
            <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-semibold">
              Role
            </span>
            <span className="text-xs font-medium text-stone-800 dark:text-stone-200 mt-0.5 block">
              {ROLE_LABEL[role] || role}
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

        {/* Console Quick Switch (admins only) */}
        {role === 'admin' && (
        <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-2">
          <div className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">
            Switch view
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={async () => {
                await setActiveRole('admin');
                onBack();
              }}
              className="px-3 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:opacity-90 cursor-pointer transition-all"
            >
              <Crown className="w-3.5 h-3.5 text-emerald-400" />
              <span>Admin</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await setActiveRole('teacher');
                onBack();
              }}
              className="px-3 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:opacity-90 cursor-pointer transition-all"
            >
              <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
              <span>Teacher</span>
            </button>
          </div>
        </div>
        )}
      </div>

      <InstallAppCard appName={organisation.app_name} />

      {/* Consent & Privacy Status */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-900 dark:text-stone-100">
          <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Privacy and consent</span>
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
                This removes your account, your programmes, your check-ins and your photos for good. It cannot be undone.
              </p>
            </div>
            {deleteError && (
              <p role="alert" className="text-sm text-red-700">
                {deleteError}
              </p>
            )}

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
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
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
