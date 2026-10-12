import { supabase, isDemoMode } from './supabase';
import type { Course } from '../types/database';
import { DEMO_COURSE_40, DEMO_COURSE_21, DEMO_COURSE_SILENCE } from './mockData';
import { sortProgrammes, type ProgrammeInput } from './programmeUtils';

/**
 * Every programme in the organisation's catalogue, including inactive ones,
 * in catalogue order. Used by the Programmes screen.
 */
export async function fetchProgrammes(orgId: string): Promise<Course[]> {
  if (isDemoMode()) {
    return sortProgrammes([DEMO_COURSE_40, DEMO_COURSE_SILENCE, DEMO_COURSE_21]);
  }

  const { data, error } = await supabase.from('courses').select('*').eq('org_id', orgId);
  if (error) {
    throw new Error(error.message);
  }
  return sortProgrammes((data as Course[]) || []);
}

/**
 * Creates a programme (no id) or updates one (with id).
 * Admins and teachers may do this; row level security enforces it.
 */
export async function saveProgramme(
  orgId: string,
  userId: string,
  input: ProgrammeInput
): Promise<{ success: boolean; data?: Course; error?: string }> {
  if (isDemoMode()) {
    return { success: false, error: 'Programmes cannot be changed in demo mode. Sign in with Google to edit the catalogue.' };
  }

  const row = {
    name: input.name.trim(),
    code: input.code.trim() || null,
    category: input.category.trim(),
    description: input.description.trim() || null,
    programme_days: input.programme_days,
    has_practice_track: input.has_practice_track,
    practice_name: input.has_practice_track ? input.practice_name.trim() || null : null,
    duration_days: input.duration_days,
    prerequisite_ids: input.prerequisite_ids,
    is_active: input.is_active,
    sort_order: input.sort_order,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabase.from('courses').update(row).eq('id', input.id).select('*').single()
    : supabase.from('courses').insert({ ...row, org_id: orgId, created_by: userId }).select('*').single();

  const { data, error } = await query;
  if (error) {
    const msg = error.code === '23505' ? `The code "${input.code.trim()}" is already used by another programme.` : error.message;
    return { success: false, error: msg };
  }
  return { success: true, data: data as Course };
}
