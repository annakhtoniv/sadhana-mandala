import { describe, it, expect } from 'vitest';
import {
  hasPracticeTrack,
  practiceTrackName,
  programmeRunStatus,
  pickDefaultEnrolment,
  validateProgrammeInput,
  sortProgrammes,
  type ProgrammeInput,
} from '../programmeUtils';
import type { Course, Enrolment } from '../../types/database';

const course = (over: Partial<Course> = {}): Course => ({
  id: 'c1',
  org_id: 'org',
  name: 'Happiness Program',
  description: null,
  duration_days: 40,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

const enrolment = (id: string, joinedAt: string, startDate: string, c: Course): Enrolment => ({
  id,
  org_id: 'org',
  batch_id: `b-${id}`,
  student_id: 's1',
  source: 'code',
  joined_at: joinedAt,
  batch: {
    id: `b-${id}`,
    org_id: 'org',
    course_id: c.id,
    teacher_id: 't1',
    name: `Batch ${id}`,
    start_date: startDate,
    join_code: id.toUpperCase(),
    created_at: joinedAt,
    course: c,
  },
});

const input = (over: Partial<ProgrammeInput> = {}): ProgrammeInput => ({
  name: 'Art of Silence',
  code: 'AOS',
  category: 'Advanced programme',
  description: '',
  programme_days: null,
  has_practice_track: false,
  practice_name: '',
  duration_days: 40,
  prerequisite_ids: [],
  is_active: true,
  sort_order: 20,
  ...over,
});

// 2026-10-12 08:00 UTC = 12:00 in Dubai
const REF = new Date('2026-10-12T08:00:00Z');

describe('hasPracticeTrack', () => {
  it('is true for programmes with a practice track', () => {
    expect(hasPracticeTrack(course({ has_practice_track: true }))).toBe(true);
  });

  it('is false for programmes without one (e.g. Art of Silence, VTP)', () => {
    expect(hasPracticeTrack(course({ has_practice_track: false }))).toBe(false);
  });

  it('treats rows from before Phase 5 (no flag) as practice courses', () => {
    expect(hasPracticeTrack(course())).toBe(true);
  });
});

describe('practiceTrackName', () => {
  it('uses the configured name', () => {
    expect(practiceTrackName(course({ practice_name: '40-Day Sadhana' }))).toBe('40-Day Sadhana');
  });

  it('falls back to the track length', () => {
    expect(practiceTrackName(course({ duration_days: 21 }))).toBe('21-Day Practice');
  });
});

describe('programmeRunStatus', () => {
  it('is upcoming before day 1', () => {
    expect(programmeRunStatus(course({ has_practice_track: true }), 0)).toBe('upcoming');
  });

  it('follows the practice track for practice programmes', () => {
    const hp = course({ has_practice_track: true, duration_days: 40, programme_days: 3 });
    expect(programmeRunStatus(hp, 23)).toBe('running');
    expect(programmeRunStatus(hp, 40)).toBe('running');
    expect(programmeRunStatus(hp, 41)).toBe('completed');
  });

  it('follows the programme length for other programmes', () => {
    const silence = course({ has_practice_track: false, programme_days: 3 });
    expect(programmeRunStatus(silence, 2)).toBe('running');
    expect(programmeRunStatus(silence, 26)).toBe('completed');
  });

  it('is "started" when a non-practice programme has no length set', () => {
    expect(programmeRunStatus(course({ has_practice_track: false, programme_days: null }), 4)).toBe('started');
  });
});

describe('pickDefaultEnrolment', () => {
  const hp = course({ id: 'hp', has_practice_track: true, duration_days: 40 });
  const vtp = course({ id: 'vtp', name: 'VTP', has_practice_track: false });
  const finishedHp = enrolment('old-hp', '2026-08-01T00:00:00Z', '2026-08-01', hp);
  const runningHp = enrolment('autumn', '2026-09-19T00:00:00Z', '2026-09-20', hp);
  const newestVtp = enrolment('vtp', '2026-10-08T00:00:00Z', '2026-10-09', vtp);

  it('returns null when the student has no programmes', () => {
    expect(pickDefaultEnrolment([], 'Asia/Dubai', null, REF)).toBeNull();
  });

  it('prefers a programme whose daily practice is running today', () => {
    expect(pickDefaultEnrolment([finishedHp, newestVtp, runningHp], 'Asia/Dubai', null, REF)?.id).toBe('autumn');
  });

  it('otherwise opens the most recently joined programme', () => {
    expect(pickDefaultEnrolment([finishedHp, newestVtp], 'Asia/Dubai', null, REF)?.id).toBe('vtp');
  });

  it('keeps the programme the student chose last time', () => {
    expect(pickDefaultEnrolment([runningHp, newestVtp], 'Asia/Dubai', 'vtp', REF)?.id).toBe('vtp');
  });

  it('ignores a saved choice the student is no longer enrolled in', () => {
    expect(pickDefaultEnrolment([runningHp, newestVtp], 'Asia/Dubai', 'gone', REF)?.id).toBe('autumn');
  });
});

describe('validateProgrammeInput', () => {
  const existing = [course({ id: 'hp', code: 'HP' })];

  it('accepts a valid programme', () => {
    expect(validateProgrammeInput(input(), existing)).toEqual([]);
  });

  it('requires a name and a category', () => {
    expect(validateProgrammeInput(input({ name: ' ', category: '' }), existing)).toHaveLength(2);
  });

  it('rejects a code another programme already uses, ignoring case', () => {
    expect(validateProgrammeInput(input({ code: 'hp' }), existing)[0]).toContain('already used');
  });

  it('lets a programme keep its own code when edited', () => {
    expect(validateProgrammeInput(input({ id: 'hp', name: 'Happiness Program', code: 'HP' }), existing)).toEqual([]);
  });

  it('checks the practice length only when the track is on', () => {
    expect(validateProgrammeInput(input({ has_practice_track: false, duration_days: 0 }), existing)).toEqual([]);
    expect(validateProgrammeInput(input({ has_practice_track: true, duration_days: 0 }), existing)).toHaveLength(1);
  });

  it('rejects a programme length below one day', () => {
    expect(validateProgrammeInput(input({ programme_days: 0 }), existing)).toHaveLength(1);
  });

  it('rejects a programme as its own prerequisite', () => {
    expect(validateProgrammeInput(input({ id: 'aos', prerequisite_ids: ['aos'] }), existing)).toHaveLength(1);
  });
});

describe('sortProgrammes', () => {
  it('orders by display order, then name', () => {
    const sorted = sortProgrammes([
      course({ id: 'b', name: 'B', sort_order: 20 }),
      course({ id: 'z', name: 'Z', sort_order: 10 }),
      course({ id: 'a', name: 'A', sort_order: 20 }),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(['z', 'a', 'b']);
  });
});
