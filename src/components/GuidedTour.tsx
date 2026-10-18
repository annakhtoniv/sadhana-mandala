import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

interface TourStep {
  targetId: string;
  title: string;
  text: string;
  tryIt: string;
}

/** Three short steps about the daily practice (the old step 4, the view switcher, is gone). */
const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'tour-checkin-buttons',
    title: "Today's check-in",
    text: 'This card is where you check in each day. Tap Morning, Evening or both when you have practised. Tap again to undo.',
    tryIt: 'Try it: tap Morning.',
  },
  {
    targetId: 'tour-practice-trail',
    title: '40-day trail and past days',
    text: 'Each circle is one day. Green means both, half green means one, white means not ticked yet.',
    tryIt: 'Forgot a day? Tap its circle. The card above switches to that day, so you can tick it.',
  },
  {
    targetId: 'tour-streak-card',
    title: 'Practice flame',
    text: 'The flame counts the days in a row you have practised. Morning or Evening is enough for a day to count.',
    tryIt: 'A day with no tick starts the count again. Filling in a missed day repairs it.',
  },
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
      className="fixed z-50 inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-auto md:right-6 md:w-[22rem] animate-fade-up"
    >
      <div className="ui-glass !bg-white/95 rounded-[1.5rem] p-4 max-w-md mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-700">
              Step {index + 1} of {TOUR_STEPS.length}
            </div>
            <h3 id="tour-step-title" className="font-display text-base font-semibold text-stone-950">
              {step.title}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="ui-icon-btn -mr-1 -mt-1 shrink-0" aria-label="Close the tour">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-1 text-[13px] leading-relaxed text-stone-600">{step.text}</p>
        {found ? (
          <p className="mt-1.5 text-[12px] font-medium text-stone-900">{step.tryIt}</p>
        ) : (
          <p className="mt-1.5 text-[12px] text-amber-700">
            This is on your practice home.{' '}
            {onShowPractice && (
              <button type="button" onClick={onShowPractice} className="underline font-medium cursor-pointer">
                Show me
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
              <button type="button" onClick={() => setIndex(index - 1)} className="ui-icon-btn" aria-label="Previous step">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? onClose() : setIndex(index + 1))}
              className="ui-btn-primary !py-2 !px-4 !text-xs"
            >
              {last ? 'Done' : 'Next'} {!last && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
