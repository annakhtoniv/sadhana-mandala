import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sheet } from './Sheet';
import { InstallAppCard } from './InstallAppCard';
import { Avatar } from './Avatar';
import { uploadAvatar, switchToGoogleAvatar } from '../lib/avatarService';
import { ROLE_LABEL } from '../lib/roles';
import { Camera, Loader2, Shield, CheckCircle2, LogOut, Trash2, Crown, GraduationCap } from 'lucide-react';

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
    ? new Date(profile.consent_at).toLocaleString('en-GB', {
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

      {/* Profile Card */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar name={profile?.full_name || user?.email} url={profile?.avatar_url} size={72} />
            <label
              className="absolute -bottom-1 -end-1 w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center cursor-pointer shadow-lg ring-2 ring-white hover:scale-105 transition-transform"
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
                className="mt-1 text-xs text-stone-500 underline cursor-pointer"
              >
                Use my Google photo
              </button>
            ) : (
              <p className="mt-1 text-xs text-stone-500">Photo from your Google account. Tap the camera to change it.</p>
            )}
            {photoMessage && <p className="mt-1 text-xs text-red-600">{photoMessage}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-3 bg-stone-50 rounded-xl">
            <span className="text-xs text-stone-500 uppercase tracking-wider block font-semibold">
              Role
            </span>
            <span className="text-xs font-medium text-stone-800 mt-0.5 block">
              {ROLE_LABEL[role] || role}
            </span>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl">
            <span className="text-xs text-stone-500 uppercase tracking-wider block font-semibold">
              Organisation
            </span>
            <span className="text-xs font-medium text-stone-800 mt-0.5 block truncate">
              {organisation.name}
            </span>
          </div>
        </div>

        {/* Console Quick Switch (admins only) */}
        {role === 'admin' && (
        <div className="pt-2 border-t border-stone-100 space-y-2">
          <div className="text-xs font-semibold text-stone-600">
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
              className="px-3 py-2.5 rounded-xl bg-stone-900 text-stone-100 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:opacity-90 cursor-pointer transition-all"
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
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-900">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>Privacy and consent</span>
        </div>

        <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-stone-50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-stone-700">Consent Provided:</span>
          </div>
          <span className="font-medium text-stone-900 text-xs">
            {formattedConsentDate}
          </span>
        </div>
        <p className="text-xs text-stone-500 leading-relaxed">
          Stored consent governs the collection of your daily practice responses and timestamps for teacher guidance in {organisation.timezone}.
        </p>
      </div>

      {/* Account Actions */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <button
          type="button"
          onClick={signOut}
          className="w-full py-3 px-4 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-800 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>

        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-3 px-4 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete My Account</span>
        </button>
      </div>

      {/* Delete account: confirmation */}
      <Sheet
        open={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteError(null);
        }}
        busy={isDeleting}
        size="sm"
        tone="danger"
        title="Delete your account?"
        description="This removes your account, your programmes, your check-ins and your photos for good. It cannot be undone."
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteError(null);
              }}
              disabled={isDeleting}
              className="ui-btn-ghost"
            >
              Cancel
            </button>
            <button type="button" onClick={handleDeleteAccount} disabled={isDeleting} className="ui-btn bg-red-600 text-white hover:bg-red-700">
              {isDeleting ? 'Deleting...' : 'Delete everything'}
            </button>
          </>
        }
      >
        {deleteError ? (
          <p role="alert" className="text-sm text-red-700">
            {deleteError}
          </p>
        ) : null}
      </Sheet>
    </div>
  );
};
