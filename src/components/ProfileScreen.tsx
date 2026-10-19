import React, { useState } from 'react';
import { currentLang, currentLocale } from '../i18n/locale';
import { useT, type MsgKey } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { Sheet } from './Sheet';
import { InstallAppCard } from './InstallAppCard';
import { RemindersCard } from './RemindersCard';
import { FrameCard } from './FrameCard';
import { LanguageChoices } from './LanguageSwitch';
import { Avatar } from './Avatar';
import { uploadAvatar, switchToGoogleAvatar } from '../lib/avatarService';
import { rolesOf } from '../lib/roles';
import { timeZoneCity } from '../lib/eventUtils';
import { Camera, Loader2, Shield, CheckCircle2, LogOut, Trash2, Crown, GraduationCap, Languages, ChevronDown } from 'lucide-react';

interface ProfileScreenProps {
  onBack: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack }) => {
  const { profile, user, organisation, role, setActiveRole, signOut, deleteAccount, refreshProfile } = useAuth();
  const t = useT();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const timeZone = organisation.timezone || 'Asia/Dubai';
  const formattedConsentDate = profile?.consent_at
    ? t('profile.consentAt', {
        when: new Date(profile.consent_at).toLocaleString(currentLocale(), { timeZone, dateStyle: 'medium', timeStyle: 'short' }),
        city: timeZoneCity(timeZone, currentLang()),
      })
    : t('profile.consentNone');
  const roleNames = (profile ? rolesOf(profile) : [role]).map((r) => t(`role.${r}` as MsgKey)).join(', ');

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    const res = await deleteAccount();
    setIsDeleting(false);
    // On success the person is signed out; otherwise say why it was not deleted
    if (!res.success) setDeleteError(res.error || t('profile.deleteFailed'));
  };

  const closeDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteError(null);
  };

  return (
    <div className="w-full space-y-5 animate-fade-up">
      <section className="ui-card space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar name={profile?.full_name || user?.email} url={profile?.avatar_url} frame={profile?.avatar_frame} size={72} />
            <label
              className="absolute -bottom-1 -end-1 w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center cursor-pointer shadow-lg ring-2 ring-white hover:scale-105 transition-transform"
              title={t('profile.changePhoto')}
            >
              {photoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label={t('profile.changePhoto')}
                disabled={photoBusy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file || !user) return;
                  setPhotoBusy(true);
                  setPhotoMessage(null);
                  const res = await uploadAvatar(user.id, file);
                  setPhotoBusy(false);
                  if (!res.success) setPhotoMessage({ ok: false, text: res.error || t('profile.uploadFailed') });
                  else {
                    await refreshProfile();
                    setPhotoMessage({ ok: true, text: t('profile.photoSaved') });
                  }
                }}
              />
            </label>
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold text-stone-950 truncate user-text">{profile?.full_name || user?.email}</h1>
            <p className="text-sm text-stone-600 truncate">{user?.email}</p>
            {profile?.avatar_source === 'upload' ? (
              <button
                type="button"
                disabled={photoBusy}
                onClick={async () => {
                  if (!user) return;
                  setPhotoBusy(true);
                  const res = await switchToGoogleAvatar(user.id);
                  setPhotoBusy(false);
                  if (!res.success) setPhotoMessage({ ok: false, text: res.error || t('profile.switchFailed') });
                  else {
                    await refreshProfile();
                    setPhotoMessage({ ok: true, text: t('profile.photoSaved') });
                  }
                }}
                className="mt-1 min-h-10 text-sm text-stone-700 underline cursor-pointer"
              >
                {t('profile.useGooglePhoto')}
              </button>
            ) : (
              <p className="mt-1 text-sm text-stone-600">{t('profile.photoHelp')}</p>
            )}
            {photoMessage && (
              <p role={photoMessage.ok ? 'status' : 'alert'} className={`mt-1 text-sm ${photoMessage.ok ? 'text-emerald-800' : 'text-red-700'}`}>
                {photoMessage.text}
              </p>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-stone-50 rounded-xl">
            <dt className="text-sm text-stone-600">{t('profile.role')}</dt>
            <dd className="text-base font-medium text-stone-900 mt-0.5">{roleNames}</dd>
          </div>
          <div className="p-3 bg-stone-50 rounded-xl">
            <dt className="text-sm text-stone-600">{t('profile.organisation')}</dt>
            <dd className="text-base font-medium text-stone-900 mt-0.5 break-words">{organisation.name}</dd>
          </div>
        </dl>

        {/* Quick switch between screens (admins) */}
        {role === 'admin' && (
          <div className="pt-2 border-t border-stone-100 space-y-2">
            <div className="text-sm font-semibold text-stone-700">{t('profile.switchView')}</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  await setActiveRole('admin');
                  onBack();
                }}
                className="ui-btn-primary"
              >
                <Crown className="w-4 h-4 text-emerald-400" />
                <span>{t('role.admin')}</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await setActiveRole('teacher');
                  onBack();
                }}
                className="ui-btn-primary"
              >
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                <span>{t('role.teacher')}</span>
              </button>
            </div>
          </div>
        )}
      </section>

      <FrameCard />

      <section className="ui-card space-y-3">
        <h2 className="font-display text-lg font-semibold text-stone-950 flex items-center gap-2">
          <Languages className="w-5 h-5 text-emerald-700" />
          {t('lang.choose')}
        </h2>
        <LanguageChoices />
      </section>

      <RemindersCard />

      <InstallAppCard appName={organisation.app_name} />

      <section className="ui-card space-y-3">
        <h2 className="font-display text-lg font-semibold text-stone-950 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-700" />
          {t('profile.privacy')}
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-stone-50 text-base">
          <span className="flex items-center gap-2 text-stone-700">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            {t('profile.consentGiven')}
          </span>
          <span className="font-medium text-stone-900">{formattedConsentDate}</span>
        </div>
        <ul className="text-sm text-stone-700 leading-relaxed list-disc ps-5 space-y-1">
          <li>{t('consent.name')}</li>
          <li>{t('consent.ticks')}</li>
          <li>{t('consent.more2')}</li>
        </ul>
        <details className="group">
          <summary className="min-h-11 inline-flex items-center gap-1 text-sm font-semibold text-stone-800 underline cursor-pointer list-none">
            {t('profile.privacyMore')}
            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="text-sm text-stone-600 leading-relaxed space-y-2 pt-1">
            <p>{t('consent.teacher')}</p>
            <p>{t('consent.more1')}</p>
          </div>
        </details>
        <p className="text-sm text-stone-700 leading-relaxed">
          {t('profile.keepUntil')}
          {organisation.support_email && ` ${t('profile.questions', { email: organisation.support_email })}`}
        </p>
      </section>

      <section className="ui-card space-y-3">
        <p className="text-sm text-stone-600">{t('profile.googleAccount', { email: user?.email || '' })}</p>
        <button type="button" onClick={signOut} className="ui-btn-ghost w-full">
          <LogOut className="w-4 h-4 rtl:rotate-180" />
          <span>{t('profile.signOut')}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="ui-btn w-full bg-red-50 text-red-700 hover:bg-red-100 ring-1 ring-red-200"
        >
          <Trash2 className="w-4 h-4" />
          <span>{t('profile.delete')}</span>
        </button>
      </section>

      <Sheet
        open={showDeleteConfirm}
        onClose={closeDelete}
        busy={isDeleting}
        size="sm"
        tone="danger"
        title={t('profile.deleteTitle')}
        description={t('profile.deleteBody')}
        footer={
          <>
            <button type="button" onClick={closeDelete} disabled={isDeleting} className="ui-btn-ghost">
              {t('common.cancel')}
            </button>
            <button type="button" onClick={handleDeleteAccount} disabled={isDeleting} className="ui-btn bg-red-600 text-white hover:bg-red-700">
              {isDeleting ? t('profile.deleting') : t('profile.deleteConfirm')}
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
