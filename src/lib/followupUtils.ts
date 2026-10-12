import type { FollowupKind, FollowupRecord, FollowupStep } from '../types/database';

export const FOLLOWUP_KIND_LABEL: Record<FollowupKind, string> = {
  session: 'Follow-up session',
  personal: 'Personal follow-up',
  reminder: 'Practice reminder',
};

/** How many days a reminder stays on the student's screen, counting its own day */
export const REMINDER_VISIBLE_DAYS = 3;

/** Plan in order: by day, then display order, then title. */
export function sortSteps(steps: FollowupStep[]): FollowupStep[] {
  return [...steps].sort(
    (a, b) => a.offset_day - b.offset_day || a.sort_order - b.sort_order || a.title.localeCompare(b.title)
  );
}

export type StepState = 'upcoming' | 'due' | 'scheduled' | 'done' | 'skipped' | 'shown';

export interface StepProgress {
  state: StepState;
  /** Personal follow-ups: students handled (done or skipped) and in total */
  handled?: number;
  total?: number;
}

/**
 * State of one plan step in a batch on a given day.
 * - session: upcoming before its day; then scheduled / done / skipped from its
 *   record, or due if nothing is recorded yet (a scheduled session counts as handled)
 * - personal: upcoming before its day; done once every student is done or skipped
 * - reminder: upcoming before its day, then shown (nothing to do)
 */
export function stepProgress(
  step: FollowupStep,
  dayNumber: number,
  records: FollowupRecord[],
  studentIds: string[]
): StepProgress {
  const mine = records.filter((r) => r.step_id === step.id);

  if (step.kind === 'reminder') {
    return { state: dayNumber < step.offset_day ? 'upcoming' : 'shown' };
  }

  if (step.kind === 'session') {
    const record = mine.find((r) => r.student_id === null);
    if (record) return { state: record.status };
    return { state: dayNumber < step.offset_day ? 'upcoming' : 'due' };
  }

  const handledIds = new Set(mine.filter((r) => r.student_id && r.status !== 'scheduled').map((r) => r.student_id));
  const handled = studentIds.filter((id) => handledIds.has(id)).length;
  const total = studentIds.length;
  if (total > 0 && handled === total) return { state: 'done', handled, total };
  return { state: dayNumber < step.offset_day ? 'upcoming' : 'due', handled, total };
}

/** Number of steps that need the teacher now (due today or earlier and not handled). */
export function countDue(steps: FollowupStep[], dayNumber: number, records: FollowupRecord[], studentIds: string[]): number {
  return steps.filter((s) => s.is_active && stepProgress(s, dayNumber, records, studentIds).state === 'due').length;
}

/** Reminders a student sees today: from their day for REMINDER_VISIBLE_DAYS days, newest first. */
export function activeReminders(steps: FollowupStep[], dayNumber: number): FollowupStep[] {
  return sortSteps(steps)
    .filter(
      (s) =>
        s.kind === 'reminder' &&
        s.is_active &&
        dayNumber >= s.offset_day &&
        dayNumber < s.offset_day + REMINDER_VISIBLE_DAYS
    )
    .reverse();
}

export interface StepInput {
  id?: string;
  kind: FollowupKind;
  title: string;
  description: string;
  offset_day: number;
  sort_order: number;
  is_active: boolean;
}

export function validateStepInput(input: StepInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('Please enter a title.');
  if (!Number.isInteger(input.offset_day) || input.offset_day < 1 || input.offset_day > 365) {
    errors.push('The day must be between 1 and 365.');
  }
  return errors;
}
