import type { Course, Enrolment } from '../types/database';
import { calculateDayNumber } from './dateUtils';

/**
 * Whether a programme has a daily practice track (check-ins, streak, trail).
 * Rows from before Phase 5 have no flag; they were all practice courses.
 */
export function hasPracticeTrack(course: Course | null | undefined): boolean {
  return course?.has_practice_track !== false;
}

/** Display name of a programme's practice track, e.g. "40-Day Sadhana". */
export function practiceTrackName(course: Course | null | undefined): string {
  if (!course) return 'Daily practice';
  return course.practice_name || `${course.duration_days}-Day Practice`;
}

export type RunStatus = 'upcoming' | 'running' | 'completed' | 'started';

/**
 * Status of one run (batch) of a programme on a given day number.
 * - Practice programmes run until the end of their practice track.
 * - Other programmes run for programme_days if known; with no length set,
 *   a started run is just "started".
 */
export function programmeRunStatus(course: Course | null | undefined, dayNumber: number): RunStatus {
  if (dayNumber < 1) return 'upcoming';
  const lastDay = hasPracticeTrack(course) ? course?.duration_days || 40 : course?.programme_days;
  if (!lastDay) return 'started';
  return dayNumber <= lastDay ? 'running' : 'completed';
}

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  upcoming: 'Upcoming',
  running: 'In progress',
  completed: 'Completed',
  started: 'Started',
};

/**
 * The enrolment to open first on the student home: a programme whose daily
 * practice is running today, else the most recently joined one.
 * A saved choice wins if the student is still enrolled in it.
 */
export function pickDefaultEnrolment(
  enrolments: Enrolment[],
  timeZone: string,
  savedEnrolmentId?: string | null,
  refDate?: Date
): Enrolment | null {
  if (enrolments.length === 0) return null;
  const saved = savedEnrolmentId ? enrolments.find((e) => e.id === savedEnrolmentId) : undefined;
  if (saved) return saved;

  const byNewest = [...enrolments].sort((a, b) => b.joined_at.localeCompare(a.joined_at));
  const practisingNow = byNewest.find((e) => {
    const course = e.batch?.course;
    if (!e.batch?.start_date || !hasPracticeTrack(course)) return false;
    const day = calculateDayNumber(e.batch.start_date, timeZone, refDate);
    return programmeRunStatus(course, day) === 'running';
  });
  return practisingNow || byNewest[0];
}

export interface ProgrammeInput {
  id?: string;
  name: string;
  code: string;
  category: string;
  description: string;
  programme_days: number | null;
  has_practice_track: boolean;
  practice_name: string;
  duration_days: number;
  prerequisite_ids: string[];
  is_active: boolean;
  sort_order: number;
}

/** Returns a list of problems; an empty list means the programme can be saved. */
export function validateProgrammeInput(input: ProgrammeInput, existing: Course[]): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push('Please enter a programme name.');
  if (!input.category.trim()) errors.push('Please enter a category.');

  const code = input.code.trim().toLowerCase();
  if (code && existing.some((c) => c.id !== input.id && (c.code || '').trim().toLowerCase() === code)) {
    errors.push(`The code "${input.code.trim()}" is already used by another programme.`);
  }

  if (input.programme_days !== null && (!Number.isInteger(input.programme_days) || input.programme_days < 1)) {
    errors.push('Programme length must be a whole number of days, 1 or more.');
  }

  if (input.has_practice_track) {
    if (!Number.isInteger(input.duration_days) || input.duration_days < 1 || input.duration_days > 365) {
      errors.push('Practice length must be between 1 and 365 days.');
    }
  }

  if (input.id && input.prerequisite_ids.includes(input.id)) {
    errors.push('A programme cannot be its own prerequisite.');
  }
  return errors;
}

/** Catalogue order: display order, then name. */
export function sortProgrammes(courses: Course[]): Course[] {
  return [...courses].sort(
    (a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100) || a.name.localeCompare(b.name)
  );
}
