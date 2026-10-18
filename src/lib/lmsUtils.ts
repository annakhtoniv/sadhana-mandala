import { translate } from '../i18n';
import type { Lesson, LessonModule, ModuleUnlockRule } from '../types/database';

/** Modules and lessons in display order (ties broken like the database: created_at, then id). */
export function sortByDisplayOrder<T extends { sort_order?: number; created_at: string; id: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      (a.sort_order ?? 100) - (b.sort_order ?? 100) ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id)
  );
}

export interface ModuleState {
  unlocked: boolean;
  /** Short explanation shown on a locked module */
  reason: string | null;
  completedCount: number;
  totalCount: number;
  complete: boolean;
}

function publishedLessons(module: LessonModule): Lesson[] {
  return (module.lessons || []).filter((l) => l.published);
}

/**
 * Lock and progress state of every published module of a programme for one
 * student. Mirrors module_unlocked_for_me() in supabase/phase6_lms.sql:
 * - 'always': open
 * - 'day': open from day N of the student's batch (dayNumber)
 * - 'sequential': open when every published lesson of the previous module is done
 * Students cannot see the lessons of a locked module (the database hides them),
 * so a sequential module after a locked module is treated as locked too.
 */
export function moduleStates(
  modules: LessonModule[],
  dayNumber: number,
  completedLessonIds: Set<string>
): Map<string, ModuleState> {
  const states = new Map<string, ModuleState>();
  let previous: LessonModule | null = null;
  let previousUnlocked = true;

  for (const module of sortByDisplayOrder(modules.filter((m) => m.published))) {
    const lessons = publishedLessons(module);
    const completedCount = lessons.filter((l) => completedLessonIds.has(l.id)).length;
    const complete = completedCount === lessons.length;

    let unlocked = true;
    let reason: string | null = null;
    if (module.unlock_rule === 'day') {
      unlocked = dayNumber >= (module.unlock_day ?? 1);
      if (!unlocked) reason = translate('learn.opensDay', { day: module.unlock_day ?? '' });
    } else if (module.unlock_rule === 'sequential' && previous) {
      const prevLessons = publishedLessons(previous);
      unlocked = previousUnlocked && prevLessons.every((l) => completedLessonIds.has(l.id));
      if (!unlocked) reason = translate('learn.opensAfter', { title: previous.title });
    }

    states.set(module.id, { unlocked, reason, completedCount, totalCount: lessons.length, complete });
    previous = module;
    previousUnlocked = unlocked;
  }
  return states;
}

/** Overall progress of a programme's published lessons, e.g. { done: 3, total: 9 }. */
export function programmeProgress(modules: LessonModule[], completedLessonIds: Set<string>): { done: number; total: number } {
  const lessons = modules.filter((m) => m.published).flatMap(publishedLessons);
  return { done: lessons.filter((l) => completedLessonIds.has(l.id)).length, total: lessons.length };
}

export const UNLOCK_RULE_LABEL: Record<ModuleUnlockRule, string> = {
  always: 'Open from the start',
  day: 'Opens on a day of the batch',
  sequential: 'Opens after the previous module',
};

export interface ModuleInput {
  id?: string;
  title: string;
  description: string;
  sort_order: number;
  unlock_rule: ModuleUnlockRule;
  unlock_day: number | null;
  published: boolean;
}

export function validateModuleInput(input: ModuleInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('Please enter a module title.');
  if (input.unlock_rule === 'day' && (!Number.isInteger(input.unlock_day) || (input.unlock_day ?? 0) < 1)) {
    errors.push('Please enter the day the module opens (1 or more).');
  }
  return errors;
}

export interface LessonInput {
  id?: string;
  title: string;
  body: string;
  video_url: string;
  estimated_minutes: number | null;
  sort_order: number;
  published: boolean;
}

export function validateLessonInput(input: LessonInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('Please enter a lesson title.');
  if (!input.body.trim() && !input.video_url.trim()) errors.push('Please add lesson text or a video link.');
  if (input.video_url.trim() && !/^https:\/\/\S+$/i.test(input.video_url.trim())) {
    errors.push('The video link must start with https://');
  }
  if (input.estimated_minutes !== null && (!Number.isInteger(input.estimated_minutes) || input.estimated_minutes < 1)) {
    errors.push('Minutes must be a whole number, 1 or more.');
  }
  return errors;
}
