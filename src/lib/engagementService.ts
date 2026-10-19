/**
 * Phase 22: practising together. Batch milestones, teachers' encouragement,
 * reflections after practice and the language reminders are written in.
 */
import { supabase } from './supabase';
import { friendlyError } from './errors';

export interface Milestone {
  week: number;
  completed: number;
  students: number;
}

/** Per finished week: how many of the batch practised all 7 days (counts only, never names). */
export async function fetchBatchMilestones(batchId: string): Promise<Milestone[]> {
  const { data, error } = await supabase.rpc('batch_milestones', { p_batch: batchId });
  if (error) throw error;
  return ((data as Milestone[] | null) || []).sort((a, b) => a.week - b.week);
}

export type EncouragementKind = 'quiet' | 'week' | 'note';

export async function sendEncouragement(
  batchId: string,
  studentIds: string[],
  kind: EncouragementKind,
  message: string
): Promise<{ success: boolean; sent?: number; error?: string }> {
  const { data, error } = await supabase.rpc('send_encouragement', {
    p_batch: batchId,
    p_students: studentIds,
    p_kind: kind,
    p_message: message,
  });
  if (error) return { success: false, error: friendlyError(error) };
  return { success: true, sent: (data as number) || 0 };
}

export interface Encouragement {
  id: string;
  message: string;
  kind: EncouragementKind;
  created_at: string;
  from?: { full_name: string | null } | null;
}

/** Messages from teachers the student has not read yet, newest first. */
export async function fetchUnreadEncouragements(userId: string): Promise<Encouragement[]> {
  const { data, error } = await supabase
    .from('encouragements')
    .select('id, message, kind, created_at, from:profiles!encouragements_from_id_fkey(full_name)')
    .eq('to_id', userId)
    .is('seen_at', null)
    .order('created_at', { ascending: false })
    .limit(3);
  if (error) throw error;
  return (data as unknown as Encouragement[]) || [];
}

export async function markEncouragementSeen(id: string): Promise<void> {
  await supabase.rpc('mark_encouragement_seen', { p_id: id });
}

export const MOODS = ['calm', 'joyful', 'grateful', 'restless', 'tired'] as const;
export type Mood = (typeof MOODS)[number];

/** The student's short reflection on one day's practice (the day must have a tick). */
export async function saveReflection(
  batchId: string,
  studentId: string,
  day: number,
  mood: Mood | null,
  note: string
): Promise<{ success: boolean; error?: string }> {
  const { error, count } = await supabase
    .from('checkins')
    .update({ mood, note: note.trim() || null }, { count: 'exact' })
    .eq('batch_id', batchId)
    .eq('student_id', studentId)
    .eq('day_number', day);
  if (error) return { success: false, error: friendlyError(error) };
  if (count === 0) return { success: false, error: 'Tick the practice first, then add a reflection.' };
  return { success: true };
}

/** Reminders are written in this language (silently skipped before phase 22 ran). */
export async function saveReminderLanguage(userId: string, lang: string): Promise<void> {
  await supabase.from('profiles').update({ preferred_lang: lang }).eq('id', userId);
}
