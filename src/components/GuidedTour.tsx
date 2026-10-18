import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useT, type MsgKey } from '../i18n';

/** Three short steps about the daily practice (the old step 4, the view switcher, is gone). */
const TOUR_STEPS: Array<{ targetId: string; key: 'checkin' | 'trail' | 'flame' }> = [
  { targetId: 'tour-checkin-buttons', key: 'checkin' },
  { targetId: 'tour-practice-trail', key: 'trail' },
  { targetId: 'tour-streak-card', key: 'flame' },
];

const HIGHLIGHT = ['ring-2', 'ring-emerald-500', 'ring-offset-4', 'ring-offset-[#f7f7f8]', 'rounded-[1.25rem]', 'relative', 'z-40'];

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  /** Opens the student home, where the practice lives (for teachers and admins) */
  onShowPractice?: () => void;
}

/**
 * Guided tour: a compact card above the tab bar (never a full-screen box)
 * that highlights one part of the practice at a time.
 */
export const GuidedTour: React.FC<GuidedTourProps> = ({ isOpen, onClose, onShowPractice }) => {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [found, setFound] = useState(true);
  const step = TOUR_STEPS[index];

  useEffect(() => {
    if (!isOpen) return;
    let target: HTMLElement | null = null;
    // Wait a moment: the screen may still be rendering
    const timer = window.setTimeout(() => {
      target = document.getElementById(step.targetId);
      setFound(Boolean(target));
      if (target) {
        target.classList.add(...HIGHLIGHT);
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
    return () => {
      window.clearTimeout(timer);
      if (target) target.classList.remove(...HIGHLIGHT);
    };
  }, [isOpen, index, step.targetId]);

  useEffect(() => {
    if (isOpen) setIndex(0);
  }, [isOpen]);

  if (!isOpen) return null;
  const last = index === TOUR_STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-labelledby="tour-step-title"
      className="fixed z-50 inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-auto md:end-6 md:w-[22rem] animate-fade-up"
    >
      <div className="ui-glass !bg-white/95 rounded-[1.5rem] p-4 max-w-md mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-700">
              {t('tour.step', { n: index + 1, total: TOUR_STEPS.length })}
            </div>
            <h3 id="tour-step-title" className="font-display text-base font-semibold text-stone-950">
              {t(`tour.${step.key}.title` as MsgKey)}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="ui-icon-btn -me-1 -mt-1 shrink-0" aria-label={t('tour.close')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-1 text-sm leading-relaxed text-stone-700">{t(`tour.${step.key}.text` as MsgKey)}</p>
        {found ? (
          <p className="mt-1.5 text-sm font-medium text-stone-900">{t(`tour.${step.key}.try` as MsgKey)}</p>
        ) : (
          <p className="mt-1.5 text-sm text-amber-800">
            {t('tour.notHere')}{' '}
            {onShowPractice && (
              <button type="button" onClick={onShowPractice} className="underline font-medium cursor-pointer">
                {t('tour.showMe')}
              </button>
            )}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden="true">
            {TOUR_STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-stone-900' : 'w-1.5 bg-stone-300'}`} />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <button type="button" onClick={() => setIndex(index - 1)} className="ui-icon-btn" aria-label={t('tour.previous')}>
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? onClose() : setIndex(index + 1))}
              className="ui-btn-primary !py-2 !px-4"
            >
              {last ? t('tour.done') : t('tour.next')} {!last && <ArrowRight className="w-4 h-4 rtl:rotate-180" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
