import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, X, Sparkles, CheckCircle2 } from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  description: string;
  actionHint: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'tour-checkin-card',
    title: "1. Today's Practice Check-in",
    description:
      "Start here every day! Answer the daily question by tapping Done, Not yet, or Rest day. Tapping twice updates your answer anytime.",
    actionHint: 'Tap Done or Rest day to record your answer for today.',
  },
  {
    targetId: 'tour-practice-trail',
    title: '2. Marking Past Dates',
    description:
      'Did your meditation yesterday but forgot to mark it? You can tap any past day in the 40-day trail below to record or edit your answer. Future days are safely locked.',
    actionHint: 'Tap Day 22 or any past tile to view or update your past answer.',
  },
  {
    targetId: 'tour-streak-card',
    title: '3. Practice Flame Streak',
    description:
      "Consecutive 'Done' days build your practice streak! Rest days preserve your streak safely without breaking it, while missed days reset it.",
    actionHint: 'Watch your flame counter grow as you maintain consistency.',
  },
  {
    targetId: 'tour-role-switcher',
    title: '4. Persona Switcher (For Demo & PM)',
    description:
      'You can switch between Student, Teacher, and Admin views on the fly using this dropdown in the header to inspect all screens without logging into multiple accounts.',
    actionHint: 'Select Teacher to see the batch dashboard and student roster.',
  },
];

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({ isOpen, onClose }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    const step = TOUR_STEPS[currentStepIndex];
    if (!step) return;

    // Scroll target into view
    const element = document.getElementById(step.targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-4', 'ring-emerald-500/50', 'transition-all');
    }

    return () => {
      if (element) {
        element.classList.remove('ring-4', 'ring-emerald-500/50');
      }
    };
  }, [isOpen, currentStepIndex]);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStepIndex((prev: number) => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev: number) => Math.max(0, prev - 1));
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-end p-4 sm:p-6 bg-stone-950/40 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="pointer-events-auto max-w-md w-full mx-auto bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl p-5 space-y-4">
        {/* Header with step counter & close */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Interactive Guide &bull; Step {currentStepIndex + 1} of {TOUR_STEPS.length}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title="Close Guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            {currentStep.title}
          </h3>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            {currentStep.description}
          </p>
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/60 text-[11px] font-medium text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{currentStep.actionHint}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 cursor-pointer"
          >
            Skip Guide
          </button>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
            >
              <span>{isLastStep ? 'Got It!' : 'Next'}</span>
              {!isLastStep && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
