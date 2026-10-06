import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, ChevronLeft, X, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  description: string;
  actionHint: string;
  actionKey: 'checkin' | 'trail' | 'streak' | 'role';
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'tour-checkin-buttons',
    title: "1. Today's Practice Check-in",
    description:
      "Start here every day! Tap 'Done' or 'Rest day' to record your practice. Tapping twice updates your answer anytime.",
    actionHint: 'Tap Done, Not yet, or Rest day right here on this card',
    actionKey: 'checkin',
  },
  {
    targetId: 'tour-practice-trail',
    title: '2. 40-Day Trail & Past Dates',
    description:
      'Did your meditation yesterday but forgot to mark it? Tap any past day tile (1–22) in the trail to record or adjust missed sessions. Future days stay greyed out.',
    actionHint: 'Tap Day 22 or any past tile to view or update your past answer',
    actionKey: 'trail',
  },
  {
    targetId: 'tour-streak-card',
    title: '3. Practice Flame Streak',
    description:
      "Consecutive 'Done' days build your practice streak! Rest days preserve your streak safely without breaking it, while missed days reset it.",
    actionHint: 'Consistency is celebrated — rest days keep your flame safe',
    actionKey: 'streak',
  },
  {
    targetId: 'tour-role-switcher',
    title: '4. Persona Switcher (For Demo & PM)',
    description:
      'Switch between Student, Teacher, and Admin views on the fly using this dropdown to inspect all screens without logging out.',
    actionHint: 'Select Teacher to see the batch dashboard and student roster',
    actionKey: 'role',
  },
];

interface PositionCoords {
  top: number;
  left: number;
  width: number;
  placement: 'top' | 'bottom';
  arrowLeft: number;
}

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({ isOpen, onClose }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [coords, setCoords] = useState<PositionCoords | null>(null);
  const [celebrationMsg, setCelebrationMsg] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Track user fluency / actions mastered
  const [masteredActions, setMasteredActions] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('sadhana_mastered_actions');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const cardRef = useRef<HTMLDivElement>(null);
  const activeStep = TOUR_STEPS[currentStepIndex];

  // Mark an action as mastered and persist
  const markActionMastered = useCallback((key: string, customCelebration?: string) => {
    setMasteredActions((prev) => {
      const next = new Set(prev);
      next.add(key);
      try {
        localStorage.setItem('sadhana_mastered_actions', JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });

    if (customCelebration) {
      setCelebrationMsg(customCelebration);
      setTimeout(() => setCelebrationMsg(null), 3000);
    }
  }, []);

  // Calculate live position tethered directly to the target element
  const updatePosition = useCallback(() => {
    if (!isOpen || isCompleted || !activeStep) return;

    // First try the specific target, fallback to card if container
    let target = document.getElementById(activeStep.targetId);
    if (!target && activeStep.targetId === 'tour-checkin-buttons') {
      target = document.getElementById('tour-checkin-card');
    }
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const tooltipWidth = Math.min(340, window.innerWidth - 32);
    const gap = 14;

    // Horizontal centering clamped to viewport
    const targetCenterX = rect.left + rect.width / 2;
    let left = targetCenterX - tooltipWidth / 2;
    left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, left));

    // Arrow pointer offset inside tooltip (0 to tooltipWidth)
    const arrowLeft = Math.max(24, Math.min(tooltipWidth - 24, targetCenterX - left));

    // Vertical placement (determine whether above or below)
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let placement: 'top' | 'bottom' = 'bottom';
    let top = 0;

    // If target is near top of screen (e.g. header dropdown), always place below
    if (rect.top < 120) {
      placement = 'bottom';
      top = rect.bottom + gap;
    } else if (spaceBelow >= 240) {
      placement = 'bottom';
      top = rect.bottom + gap;
    } else if (spaceAbove >= 200) {
      placement = 'top';
      // Will be translated up by 100% in CSS
      top = rect.top - gap;
    } else {
      placement = 'bottom';
      top = Math.max(60, rect.bottom + gap);
    }

    setCoords({
      top,
      left,
      width: tooltipWidth,
      placement,
      arrowLeft,
    });
  }, [isOpen, isCompleted, activeStep]);

  // Highlight active element and scroll into view
  useEffect(() => {
    if (!isOpen || isCompleted || !activeStep) return;

    let target = document.getElementById(activeStep.targetId);
    if (!target && activeStep.targetId === 'tour-checkin-buttons') {
      target = document.getElementById('tour-checkin-card');
    }

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      target.classList.add(
        'ring-4',
        'ring-emerald-500',
        'ring-offset-2',
        'ring-offset-white',
        'dark:ring-offset-stone-900',
        'transition-all',
        'duration-300'
      );
    }

    updatePosition();

    return () => {
      if (target) {
        target.classList.remove(
          'ring-4',
          'ring-emerald-500',
          'ring-offset-2',
          'ring-offset-white',
          'dark:ring-offset-stone-900'
        );
      }
    };
  }, [isOpen, currentStepIndex, isCompleted, activeStep, updatePosition]);

  // Reposition on scroll and window resize
  useEffect(() => {
    if (!isOpen || isCompleted) return;

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, isCompleted, updatePosition]);

  // Listen to user actions across the app to gauge fluency in real time
  useEffect(() => {
    if (!isOpen || isCompleted) return;

    const handleCheckinAction = () => {
      markActionMastered('checkin', '🎉 Check-in recorded! You mastered Step 1.');
      if (currentStepIndex === 0) {
        setTimeout(() => {
          setCurrentStepIndex(1);
        }, 1200);
      }
    };

    const handleTrailAction = () => {
      markActionMastered('trail', '✨ Past date selected! You mastered Step 2.');
      if (currentStepIndex === 1) {
        setTimeout(() => {
          setCurrentStepIndex(2);
        }, 1200);
      }
    };

    const handleRoleAction = () => {
      markActionMastered('role', '👁️ Role switched! You mastered Step 4.');
      if (currentStepIndex === 3) {
        setTimeout(() => {
          handleFinishTour();
        }, 1200);
      }
    };

    window.addEventListener('sadhana_action_checkin', handleCheckinAction);
    window.addEventListener('sadhana_action_trailday', handleTrailAction);
    window.addEventListener('sadhana_action_roleswitch', handleRoleAction);

    return () => {
      window.removeEventListener('sadhana_action_checkin', handleCheckinAction);
      window.removeEventListener('sadhana_action_trailday', handleTrailAction);
      window.removeEventListener('sadhana_action_roleswitch', handleRoleAction);
    };
  }, [isOpen, currentStepIndex, isCompleted, markActionMastered]);

  const fluencyPercentage = Math.round((masteredActions.size / TOUR_STEPS.length) * 100);

  const handleNext = () => {
    if (activeStep) {
      markActionMastered(activeStep.actionKey);
    }

    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleFinishTour();
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleFinishTour = () => {
    setIsCompleted(true);
    localStorage.setItem('sadhana_tour_completed', 'true');
    localStorage.setItem('sadhana_navigation_mastered', 'true');
    setTimeout(() => {
      onClose();
    }, 3800);
  };

  const handleDismissForever = () => {
    localStorage.setItem('sadhana_tour_completed', 'true');
    localStorage.setItem('sadhana_navigation_mastered', 'true');
    onClose();
  };

  if (!isOpen) return null;

  // Completion Graduation Screen
  if (isCompleted) {
    return (
      <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4 bg-stone-950/20 backdrop-blur-[2px] animate-in fade-in duration-200">
        <div className="pointer-events-auto max-w-sm w-full bg-white dark:bg-stone-900 rounded-3xl border border-emerald-500/40 shadow-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-300 dark:border-emerald-700 shadow-sm">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Navigation Mastered (100%)
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              You are navigating smoothly! The step-by-step tooltips are now retired so you can practice without interruption.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300">
            Tip: Click the <strong className="font-semibold">?</strong> icon in the header anytime if you ever want guidance back.
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-sm"
          >
            Start Practicing
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Non-modal subtle backdrop: clicks pass through so user can interact with highlighted buttons! */}
      <div className="fixed inset-0 z-30 pointer-events-none bg-stone-950/20 transition-opacity duration-300" />

      {/* Pointing Tooltip Popover */}
      {coords && (
        <div
          ref={cardRef}
          role="dialog"
          aria-labelledby="tour-step-title"
          style={{
            position: 'fixed',
            top: coords.placement === 'top' ? `${coords.top}px` : `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            transform: coords.placement === 'top' ? 'translateY(-100%)' : 'none',
          }}
          className="z-50 pointer-events-auto bg-white dark:bg-stone-900 rounded-2xl border-2 border-emerald-500/80 shadow-2xl p-4 space-y-3.5 transition-all duration-200 animate-in fade-in zoom-in-95"
        >
          {/* Callout Arrow Pointer pointing straight at the target element */}
          {coords.placement === 'bottom' ? (
            <div
              style={{ left: `${coords.arrowLeft}px` }}
              className="absolute -top-2.5 -translate-x-1/2 w-4 h-4 bg-white dark:bg-stone-900 border-t-2 border-l-2 border-emerald-500/80 rotate-45"
            />
          ) : (
            <div
              style={{ left: `${coords.arrowLeft}px` }}
              className="absolute -bottom-2.5 -translate-x-1/2 w-4 h-4 bg-white dark:bg-stone-900 border-b-2 border-r-2 border-emerald-500/80 rotate-45"
            />
          )}

          {/* Top Bar: Step Counter, Fluency Gauge & Close */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Step {currentStepIndex + 1} of {TOUR_STEPS.length}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              title="Close for now"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fluency Gauge Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400 font-medium">
              <span>Navigation Fluency:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {fluencyPercentage}% {fluencyPercentage >= 75 ? '• Confident' : '• Learning'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(15, fluencyPercentage)}%` }}
              />
            </div>
          </div>

          {/* Step Content */}
          <div className="space-y-1">
            <h3 id="tour-step-title" className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {activeStep.title}
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              {activeStep.description}
            </p>
          </div>

          {/* Direct Action Callout / Celebration */}
          {celebrationMsg ? (
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in zoom-in-95">
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{celebrationMsg}</span>
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-900/60 text-[11px] font-medium text-emerald-800 dark:text-emerald-300 flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" />
              <span>{activeStep.actionHint}</span>
            </div>
          )}

          {/* Controls: Skip / Back / Next */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleDismissForever}
              className="text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 cursor-pointer font-medium"
              title="Stop showing tooltips"
            >
              Retire Guide
            </button>

            <div className="flex items-center gap-1.5">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span>Back</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="px-3.5 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
              >
                <span>{currentStepIndex === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}</span>
                {currentStepIndex < TOUR_STEPS.length - 1 ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ArrowRight className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
