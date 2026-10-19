import type { BadgeId } from './practiceUtils';

/**
 * Weekly badges and the photo frames they unlock (Phase 21). Each frame has
 * its own colours and a small emblem with the week number (or a star for the
 * whole practice), so a frame never depends on colour alone.
 */
export interface BadgeLook {
  /** Translation key of the badge name */
  nameKey: 'badge.seed' | 'badge.sprout' | 'badge.bloom' | 'badge.lotus' | 'badge.radiance' | 'badge.week' | 'badge.complete';
  /** Two colours of the ring */
  from: string;
  to: string;
  /** Text on the small emblem */
  emblem: string;
}

const WEEK_LOOKS: Array<Omit<BadgeLook, 'emblem'>> = [
  { nameKey: 'badge.seed', from: '#86EFAC', to: '#15803D' },
  { nameKey: 'badge.sprout', from: '#BEF264', to: '#4D7C0F' },
  { nameKey: 'badge.bloom', from: '#F9A8D4', to: '#BE185D' },
  { nameKey: 'badge.lotus', from: '#C4B5FD', to: '#6D28D9' },
  { nameKey: 'badge.radiance', from: '#FCD34D', to: '#B45309' },
];

export function weekNumber(id: string): number | null {
  const m = /^week(\d+)$/.exec(id);
  return m ? parseInt(m[1], 10) : null;
}

export function badgeLook(id: string): BadgeLook | null {
  if (id === 'complete') return { nameKey: 'badge.complete', from: '#FDE047', to: '#047857', emblem: '★' };
  const w = weekNumber(id);
  if (!w) return null;
  const look = WEEK_LOOKS[w - 1] || { nameKey: 'badge.week' as const, from: '#A5F3FC', to: '#0E7490' };
  return { ...look, emblem: String(w) };
}

/** Every badge a practice of this length offers, in order. */
export function badgesFor(durationDays: number, fullWeeks: number): BadgeId[] {
  const ids: BadgeId[] = [];
  for (let w = 1; w <= fullWeeks; w++) ids.push(`week${w}`);
  if (durationDays > 0) ids.push('complete');
  return ids;
}
