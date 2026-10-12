import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchProgrammeModules, fetchMyLessonProgress, setLessonComplete } from '../lib/lmsService';
import { moduleStates, programmeProgress } from '../lib/lmsUtils';
import { renderMarkdown } from '../lib/markdown';
import type { Course, Lesson, LessonModule } from '../types/database';
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
      .catch((err) => active && setLoadError(err instanceof Error ? err.message : 'Could not load lessons'))
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
      setSaveError(res.error || 'Could not save. Please try again.');
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
      <div ref={cardRef} className="scroll-mt-20 bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4 animate-in fade-in">
        <button
          type="button"
          onClick={() => {
            setReading(null);
            setSaveError(null);
          }}
          className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to lessons</span>
        </button>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">{reading.title}</h2>
          {reading.estimated_minutes ? (
            <div className="inline-flex items-center gap-1 text-[11px] text-stone-500">
              <Clock className="w-3 h-3" />
              {reading.estimated_minutes} min
            </div>
          ) : null}
        </div>
        {reading.video_url && /^https:\/\//i.test(reading.video_url) && (
          <a
            href={reading.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-stone-200 dark:border-stone-700 text-sm font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
          >
            <Video className="w-4 h-4" />
            <span>Watch the video</span>
          </a>
        )}
        <div className="text-sm leading-relaxed text-stone-700 dark:text-stone-300 space-y-3">{renderMarkdown(reading.body || '')}</div>
        {saveError && <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>}
        <button
          type="button"
          onClick={() => toggleComplete(reading)}
          disabled={saving}
          className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${
            done
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>{saving ? 'Saving...' : done ? 'Completed · tap to undo' : 'Mark as complete'}</span>
        </button>
      </div>
    );
  }

  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div id="tour-learning" ref={cardRef} className="scroll-mt-20 bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Learning</h2>
        </div>
        <span className="text-[11px] text-stone-500">
          {progress.done} of {progress.total} lessons
        </span>
      </div>
      <div className="h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-emerald-600 transition-all" style={{ width: `${percent}%` }} />
      </div>

      {loadError && <p className="text-xs text-red-600 dark:text-red-400">Could not load lessons: {loadError}</p>}

      <div className="space-y-2">
        {published.map((m) => {
          const state = states.get(m.id);
          const open = openModuleId === m.id && state?.unlocked;
          return (
            <div key={m.id} className="rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden">
              <button
                type="button"
                onClick={() => state?.unlocked && setOpenModuleId(open ? null : m.id)}
                disabled={!state?.unlocked}
                aria-expanded={!!open}
                className="w-full p-3 flex items-center justify-between gap-2 text-left disabled:cursor-default cursor-pointer"
              >
                <div className="min-w-0">
                  <div className={`text-sm font-medium ${state?.unlocked ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400'}`}>
                    {m.title}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {state?.unlocked
                      ? state.complete
                        ? 'Completed'
                        : `${state.completedCount} of ${state.totalCount} done`
                      : state?.reason}
                  </div>
                </div>
                {!state?.unlocked ? (
                  <Lock className="w-4 h-4 text-stone-400 shrink-0" />
                ) : state.complete ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : open ? (
                  <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                )}
              </button>
              {open && (
                <div className="border-t border-stone-100 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800">
                  {(m.lessons || []).filter((l) => l.published).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setReading(l)}
                      className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-stone-50 dark:hover:bg-stone-800/60 cursor-pointer"
                    >
                      {completed.has(l.id) ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-stone-300 shrink-0" />
                      )}
                      <span className="flex-1 text-sm text-stone-800 dark:text-stone-200">{l.title}</span>
                      {l.video_url && <Video className="w-3.5 h-3.5 text-stone-400" />}
                      {l.estimated_minutes ? <span className="text-[10px] text-stone-400">{l.estimated_minutes} min</span> : null}
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
