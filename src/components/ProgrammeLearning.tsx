import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchProgrammeModules, fetchMyLessonProgress, setLessonComplete } from '../lib/lmsService';
import { moduleStates, programmeProgress } from '../lib/lmsUtils';
import { renderMarkdown } from '../lib/markdown';
import type { Course, Lesson, LessonModule } from '../types/database';
import { useT } from '../i18n';
import { ArrowLeft, BookOpen, Check, CheckCircle2, ChevronDown, ChevronRight, Circle, Clock, Lock, Video } from 'lucide-react';

interface ProgrammeLearningProps {
  course: Course;
  /** Today's day number in the student's batch of this programme */
  dayNumber: number;
}

/**
 * Student view of a programme's learning modules (SPEC "LMS"): modules in
 * order with their lock state and progress, a lesson reader, and
 * "Mark as complete".
 */
export const ProgrammeLearning: React.FC<ProgrammeLearningProps> = ({ course, dayNumber }) => {
  const { organisation, profile } = useAuth();
  const t = useT();
  const [modules, setModules] = useState<LessonModule[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const [reading, setReading] = useState<Lesson | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // On a phone the card sits far down the page: bring the reader (or the list) into view
  useEffect(() => {
    if (reading) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [reading]);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    setLoaded(false);
    setLoadError(null);
    Promise.all([fetchProgrammeModules(course.id), fetchMyLessonProgress(profile.id)])
      .then(([mods, done]) => {
        if (!active) return;
        setModules(mods);
        setCompleted(done);
      })
      .catch((err) => active && setLoadError(err instanceof Error ? err.message : t('learn.loadFailed')))
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [course.id, profile?.id]);

  const published = useMemo(() => modules.filter((m) => m.published), [modules]);
  const states = useMemo(() => moduleStates(published, dayNumber, completed), [published, dayNumber, completed]);
  const progress = useMemo(() => programmeProgress(published, completed), [published, completed]);

  // Open the first unlocked, unfinished module by default
  useEffect(() => {
    if (openModuleId || published.length === 0) return;
    const first = published.find((m) => states.get(m.id)?.unlocked && !states.get(m.id)?.complete) || published[0];
    setOpenModuleId(first.id);
  }, [published, states, openModuleId]);

  const toggleComplete = async (lesson: Lesson) => {
    if (!profile?.id) return;
    const done = !completed.has(lesson.id);
    setSaving(true);
    setSaveError(null);
    const res = await setLessonComplete(organisation.id, profile.id, lesson.id, done);
    setSaving(false);
    if (!res.success) {
      setSaveError(res.error || t('common.saveFailed'));
      return;
    }
    setCompleted((prev) => {
      const next = new Set(prev);
      if (done) next.add(lesson.id);
      else next.delete(lesson.id);
      return next;
    });
  };

  if (!loaded) return null;
  if (published.length === 0 && !loadError) return null;

  if (reading) {
    const done = completed.has(reading.id);
    return (
      <div ref={cardRef} className="scroll-mt-20 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4 animate-in fade-in">
        <button
          type="button"
          onClick={() => {
            setReading(null);
            setSaveError(null);
          }}
          className="ui-btn-ghost !min-h-10 !py-2 !px-4"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('learn.back')}</span>
        </button>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-stone-900 user-text">{reading.title}</h2>
          {reading.estimated_minutes ? (
            <div className="inline-flex items-center gap-1 text-xs text-stone-500">
              <Clock className="w-3 h-3" />
              {t('learn.minutes', { n: reading.estimated_minutes })}
            </div>
          ) : null}
        </div>
        {reading.video_url && /^https:\/\//i.test(reading.video_url) && (
          <a
            href={reading.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-800 hover:bg-stone-50"
          >
            <Video className="w-4 h-4" />
            <span>{t('learn.watchVideo')}</span>
          </a>
        )}
        <div className="text-base leading-relaxed text-stone-700 space-y-3 user-text">{renderMarkdown(reading.body || '')}</div>
        {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
        <button
          type="button"
          onClick={() => toggleComplete(reading)}
          disabled={saving}
          className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${
            done
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-stone-900 text-stone-100'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>{saving ? t('common.saving') : done ? t('learn.completedUndo') : t('learn.markComplete')}</span>
        </button>
      </div>
    );
  }

  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div id="tour-learning" ref={cardRef} className="scroll-mt-20 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-700" />
          <h2 className="font-display text-lg font-semibold text-stone-950">{t('learn.title')}</h2>
        </div>
        <span className="text-sm text-stone-600">
          {t('learn.progress', { done: progress.done, total: progress.total })}
        </span>
      </div>
      <div className="h-2 rounded-full bg-stone-100 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-emerald-600 transition-all" style={{ width: `${percent}%` }} />
      </div>

      {loadError && <p role="alert" className="text-sm text-red-700">{t('learn.loadFailed')}: {loadError}</p>}

      <div className="space-y-2">
        {published.map((m) => {
          const state = states.get(m.id);
          const open = openModuleId === m.id && state?.unlocked;
          return (
            <div key={m.id} className="rounded-xl border border-stone-200 overflow-hidden">
              <button
                type="button"
                onClick={() => state?.unlocked && setOpenModuleId(open ? null : m.id)}
                disabled={!state?.unlocked}
                aria-expanded={!!open}
                className="w-full min-h-14 p-3 flex items-center justify-between gap-2 text-start disabled:cursor-default cursor-pointer"
              >
                <div className="min-w-0">
                  <div className={`text-base font-medium user-text ${state?.unlocked ? 'text-stone-900' : 'text-stone-600'}`}>
                    {m.title}
                  </div>
                  <div className="text-sm text-stone-600 user-text">
                    {state?.unlocked
                      ? state.complete
                        ? t('status.completed')
                        : t('learn.moduleProgress', { done: state.completedCount, total: state.totalCount })
                      : state?.reason}
                  </div>
                </div>
                {!state?.unlocked ? (
                  <Lock className="w-4 h-4 text-stone-500 shrink-0" />
                ) : state.complete ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : open ? (
                  <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-stone-500 shrink-0 rtl:rotate-180" />
                )}
              </button>
              {open && (
                <div className="border-t border-stone-100 divide-y divide-stone-100">
                  {(m.lessons || []).filter((l) => l.published).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setReading(l)}
                      className="w-full min-h-12 px-3 py-2.5 flex items-center gap-2.5 text-start hover:bg-stone-50 cursor-pointer"
                    >
                      {completed.has(l.id) ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-stone-300 shrink-0" />
                      )}
                      <span className="flex-1 text-base text-stone-800 user-text">{l.title}</span>
                      {l.video_url && <Video className="w-3.5 h-3.5 text-stone-500" />}
                      {l.estimated_minutes ? <span className="text-sm text-stone-600">{t('learn.minutes', { n: l.estimated_minutes })}</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
