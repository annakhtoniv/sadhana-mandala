import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';
import { LanguageChoices } from './LanguageSwitch';
import { ShieldCheck, UserCheck, CalendarCheck, Eye, Check, LogOut, ChevronDown } from 'lucide-react';

/**
 * Privacy consent, shown once before anything else (the guided tour never
 * opens on top of it). Plain words first; the details are one tap away.
 */
export const ConsentModal: React.FC = () => {
  const { giveConsent, signOut, organisation } = useAuth();
  const t = useT();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const handleConsent = async () => {
    setSubmitting(true);
    setError(null);
    const res = await giveConsent();
    setSubmitting(false);
    if (!res.success) setError(res.error || t('consent.saveFailed'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        className="w-full max-w-md bg-white rounded-[1.75rem] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
      >
        <div className="px-6 pt-5">
          <LanguageChoices />
        </div>
        <div className="p-6 pb-4 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 id="consent-title" className="font-display text-xl font-semibold text-stone-950">
            {t('consent.title')}
          </h2>
          <p className="text-base text-stone-600 mt-1">{t('consent.intro', { app: organisation.app_name })}</p>
        </div>

        <div className="px-6 pb-4 overflow-y-auto space-y-3 text-base text-stone-700 leading-relaxed">
          <p className="flex items-start gap-3">
            <UserCheck className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
            <span>{t('consent.name')}</span>
          </p>
          <p className="flex items-start gap-3">
            <CalendarCheck className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
            <span>{t('consent.ticks')}</span>
          </p>
          <p className="flex items-start gap-3">
            <Eye className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
            <span>{t('consent.teacher')}</span>
          </p>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            className="inline-flex items-center gap-1 text-sm font-medium text-stone-800 underline underline-offset-2 cursor-pointer"
          >
            {t('consent.readMore')} <ChevronDown className={`w-4 h-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
          </button>
          {showMore && (
            <div className="rounded-2xl bg-stone-50 p-4 space-y-2 text-sm text-stone-700">
              <p>{t('consent.more1')}</p>
              <p>{t('consent.more2')}</p>
              <p>{t('consent.more3', { email: organisation.support_email || '' })}</p>
            </div>
          )}
        </div>

        <div className="p-6 pt-4 border-t border-stone-100 space-y-2">
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handleConsent}
            disabled={submitting}
            className="ui-btn-primary w-full justify-center !h-12"
          >
            <Check className="w-4 h-4" />
            <span>{submitting ? t('common.saving') : t('consent.agree')}</span>
          </button>
          <button
            type="button"
            onClick={signOut}
            className="w-full min-h-11 text-sm text-stone-600 hover:text-stone-900 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('consent.decline')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
