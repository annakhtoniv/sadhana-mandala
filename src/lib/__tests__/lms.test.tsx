import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  moduleStates,
  programmeProgress,
  sortByDisplayOrder,
  validateModuleInput,
  validateLessonInput,
  type LessonInput,
} from '../lmsUtils';
import { renderMarkdown } from '../markdown';
import type { Lesson, LessonModule } from '../../types/database';

const lesson = (id: string, over: Partial<Lesson> = {}): Lesson => ({
  id,
  org_id: 'org',
  title: id,
  body: 'x',
  scope: 'course',
  published: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const mod = (id: string, sort: number, over: Partial<LessonModule> = {}, lessons: Lesson[] = []): LessonModule => ({
  id,
  org_id: 'org',
  course_id: 'hp',
  title: id,
  description: null,
  sort_order: sort,
  unlock_rule: 'always',
  unlock_day: null,
  published: true,
  created_at: '2026-01-01T00:00:00Z',
  lessons,
  ...over,
});

// The seeded Happiness Program modules
const before = mod('before', 10, {}, [lesson('l1'), lesson('l2')]);
const week1 = mod('week1', 20, { unlock_rule: 'day', unlock_day: 1 }, [lesson('l3'), lesson('l4')]);
const week2 = mod('week2', 30, { unlock_rule: 'day', unlock_day: 8 }, [lesson('l5')]);
const deeper = mod('deeper', 40, { unlock_rule: 'sequential', title: 'Going deeper' }, [lesson('l6')]);
const HP = [deeper, week2, before, week1];

describe('moduleStates', () => {
  it('opens "always" modules immediately and day modules on their day', () => {
    const states = moduleStates(HP, 2, new Set());
    expect(states.get('before')?.unlocked).toBe(true);
    expect(states.get('week1')?.unlocked).toBe(true);
    expect(states.get('week2')?.unlocked).toBe(false);
    expect(states.get('week2')?.reason).toBe('Opens on day 8');
  });

  it('keeps day modules closed before the batch starts', () => {
    expect(moduleStates(HP, 0, new Set()).get('week1')?.unlocked).toBe(false);
  });

  it('opens a sequential module only when the previous module is complete', () => {
    expect(moduleStates(HP, 23, new Set(['l1', 'l2', 'l3'])).get('deeper')?.unlocked).toBe(false);
    expect(moduleStates(HP, 23, new Set(['l1', 'l2', 'l3'])).get('deeper')?.reason).toBe('Opens when you finish "week2"');
    expect(moduleStates(HP, 23, new Set(['l5'])).get('deeper')?.unlocked).toBe(true);
  });

  it('keeps a sequential module locked while the previous module is still locked', () => {
    // Week 2 opens on day 8; on day 3 its lessons are hidden, so "Going deeper" stays locked
    expect(moduleStates(HP, 3, new Set()).get('deeper')?.unlocked).toBe(false);
  });

  it('opens a sequential first module (nothing before it)', () => {
    expect(moduleStates([mod('only', 10, { unlock_rule: 'sequential' })], 1, new Set()).get('only')?.unlocked).toBe(true);
  });

  it('ignores unpublished modules and lessons', () => {
    const hidden = mod('hidden', 35, { published: false }, [lesson('h1')]);
    const draftLesson = mod('m', 10, {}, [lesson('a'), lesson('draft', { published: false })]);
    const states = moduleStates([draftLesson, hidden], 1, new Set(['a']));
    expect(states.has('hidden')).toBe(false);
    expect(states.get('m')).toMatchObject({ completedCount: 1, totalCount: 1, complete: true });
  });

  it('counts progress per module', () => {
    expect(moduleStates(HP, 23, new Set(['l1', 'l3'])).get('week1')).toMatchObject({ completedCount: 1, totalCount: 2, complete: false });
  });
});

describe('programmeProgress', () => {
  it('counts completed published lessons across modules', () => {
    expect(programmeProgress(HP, new Set(['l1', 'l2', 'l3']))).toEqual({ done: 3, total: 6 });
  });
});

describe('sortByDisplayOrder', () => {
  it('orders by sort_order, then creation time, then id', () => {
    const a = mod('a', 20, { created_at: '2026-01-02T00:00:00Z' });
    const b = mod('b', 20, { created_at: '2026-01-01T00:00:00Z' });
    const c = mod('c', 10);
    expect(sortByDisplayOrder([a, b, c]).map((m) => m.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('validation', () => {
  it('needs a module title, and a day for day-unlocked modules', () => {
    expect(validateModuleInput({ title: ' ', description: '', sort_order: 10, unlock_rule: 'always', unlock_day: null, published: true })).toHaveLength(1);
    expect(validateModuleInput({ title: 'Week 2', description: '', sort_order: 10, unlock_rule: 'day', unlock_day: null, published: true })).toHaveLength(1);
    expect(validateModuleInput({ title: 'Week 2', description: '', sort_order: 10, unlock_rule: 'day', unlock_day: 8, published: true })).toEqual([]);
  });

  const lessonInput = (over: Partial<LessonInput> = {}): LessonInput => ({
    title: 'Welcome', body: 'Text', video_url: '', estimated_minutes: 5, sort_order: 10, published: true, ...over,
  });

  it('accepts a lesson with text or a video', () => {
    expect(validateLessonInput(lessonInput())).toEqual([]);
    expect(validateLessonInput(lessonInput({ body: '', video_url: 'https://example.com/v' }))).toEqual([]);
  });

  it('rejects an empty lesson, a non-https video and bad minutes', () => {
    expect(validateLessonInput(lessonInput({ body: '', video_url: '' }))).toHaveLength(1);
    expect(validateLessonInput(lessonInput({ video_url: 'javascript:alert(1)' }))).toHaveLength(1);
    expect(validateLessonInput(lessonInput({ estimated_minutes: 0 }))).toHaveLength(1);
  });
});

describe('renderMarkdown', () => {
  const html = (md: string) => renderToStaticMarkup(<>{renderMarkdown(md)}</>);

  it('renders headings, lists, bold and italic', () => {
    const out = html('## Welcome\n\n- **One**\n- *Two*\n\n1. First\n2. Second');
    expect(out).toContain('<h3');
    expect(out).toContain('<ul');
    expect(out).toContain('<strong>One</strong>');
    expect(out).toContain('<em>Two</em>');
    expect(out).toContain('<ol');
  });

  it('joins paragraph lines with line breaks', () => {
    expect(html('line one\nline two')).toBe('<p>line one<br/>line two</p>');
  });

  it('never outputs raw HTML from the lesson text', () => {
    const out = html('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;script&gt;');
  });

  it('links only https addresses', () => {
    expect(html('[site](https://example.com)')).toContain('href="https://example.com"');
    expect(html('[bad](javascript:alert(1))')).not.toContain('href');
  });
});
