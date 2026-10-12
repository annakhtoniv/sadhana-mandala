import { describe, it, expect } from 'vitest';
import {
  activeReminders,
  countDue,
  sortSteps,
  stepProgress,
  validateStepInput,
} from '../followupUtils';
import type { FollowupRecord, FollowupStep } from '../../types/database';

const step = (id: string, kind: FollowupStep['kind'], day: number, over: Partial<FollowupStep> = {}): FollowupStep => ({
  id,
  org_id: 'org',
  course_id: 'hp',
  kind,
  title: id,
  description: null,
  offset_day: day,
  sort_order: 10,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

const record = (stepId: string, studentId: string | null, status: FollowupRecord['status']): FollowupRecord => ({
  id: `${stepId}-${studentId}`,
  org_id: 'org',
  batch_id: 'autumn',
  step_id: stepId,
  student_id: studentId,
  status,
  scheduled_for: null,
  location: null,
  notes: null,
  updated_at: '2026-01-01T00:00:00Z',
});

// The seeded Happiness Program plan
const rem1 = step('rem1', 'reminder', 1);
const call1 = step('call1', 'personal', 3);
const sess1 = step('sess1', 'session', 8);
const rem2 = step('rem2', 'reminder', 21);
const students = ['s1', 's2', 's3'];

describe('stepProgress', () => {
  it('marks every step upcoming before its day', () => {
    expect(stepProgress(call1, 2, [], students).state).toBe('upcoming');
    expect(stepProgress(sess1, 7, [], students).state).toBe('upcoming');
    expect(stepProgress(rem2, 20, [], students).state).toBe('upcoming');
  });

  it('makes a session due on its day until it is scheduled, held or skipped', () => {
    expect(stepProgress(sess1, 8, [], students).state).toBe('due');
    expect(stepProgress(sess1, 9, [record('sess1', null, 'scheduled')], students).state).toBe('scheduled');
    expect(stepProgress(sess1, 9, [record('sess1', null, 'done')], students).state).toBe('done');
    expect(stepProgress(sess1, 9, [record('sess1', null, 'skipped')], students).state).toBe('skipped');
  });

  it('lets a teacher schedule a session before its day', () => {
    expect(stepProgress(sess1, 5, [record('sess1', null, 'scheduled')], students).state).toBe('scheduled');
  });

  it('counts personal follow-ups per student and is done when all are handled', () => {
    const some = [record('call1', 's1', 'done'), record('call1', 's2', 'skipped')];
    expect(stepProgress(call1, 5, some, students)).toEqual({ state: 'due', handled: 2, total: 3 });
    const all = [...some, record('call1', 's3', 'done')];
    expect(stepProgress(call1, 5, all, students)).toEqual({ state: 'done', handled: 3, total: 3 });
  });

  it('ignores records of students who left the batch', () => {
    expect(stepProgress(call1, 5, [record('call1', 'gone', 'done')], students).handled).toBe(0);
  });

  it('shows reminders from their day (nothing for the teacher to do)', () => {
    expect(stepProgress(rem1, 1, [], students).state).toBe('shown');
  });
});

describe('countDue', () => {
  it('counts sessions and personal follow-ups that need action, not reminders or inactive steps', () => {
    const inactive = step('old', 'session', 2, { is_active: false });
    expect(countDue([rem1, call1, sess1, rem2, inactive], 23, [], students)).toBe(2);
    expect(countDue([rem1, call1, sess1], 23, [record('sess1', null, 'done')], students)).toBe(1);
  });
});

describe('activeReminders', () => {
  it('shows a reminder on its day and the two days after, newest first', () => {
    expect(activeReminders([rem1, rem2], 1).map((s) => s.id)).toEqual(['rem1']);
    expect(activeReminders([rem1, rem2], 3).map((s) => s.id)).toEqual(['rem1']);
    expect(activeReminders([rem1, rem2], 4)).toEqual([]);
    expect(activeReminders([rem1, rem2, step('rem3', 'reminder', 22)], 22).map((s) => s.id)).toEqual(['rem3', 'rem2']);
  });

  it('skips inactive reminders and other kinds', () => {
    expect(activeReminders([step('r', 'reminder', 1, { is_active: false }), call1], 3)).toEqual([]);
  });
});

describe('sortSteps', () => {
  it('orders by day, then display order', () => {
    const a = step('a', 'session', 8, { sort_order: 20 });
    const b = step('b', 'personal', 8, { sort_order: 10 });
    expect(sortSteps([sess1, a, rem1, b]).map((s) => s.id)).toEqual(['rem1', 'b', 'sess1', 'a']);
  });
});

describe('validateStepInput', () => {
  const input = { kind: 'session' as const, title: 'Week 1 session', description: '', offset_day: 8, sort_order: 10, is_active: true };

  it('accepts a valid step', () => {
    expect(validateStepInput(input)).toEqual([]);
  });

  it('needs a title and a day between 1 and 365', () => {
    expect(validateStepInput({ ...input, title: ' ' })).toHaveLength(1);
    expect(validateStepInput({ ...input, offset_day: 0 })).toHaveLength(1);
    expect(validateStepInput({ ...input, offset_day: 400 })).toHaveLength(1);
  });
});
