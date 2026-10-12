import { supabase, isDemoMode } from './supabase';
import type { BatchSession, FollowupRecord, FollowupRecordStatus, FollowupStep } from '../types/database';
import { DEMO_FOLLOWUP_STEPS } from './mockData';
import { sortSteps, type StepInput } from './followupUtils';

const DEMO_EDIT_ERROR = 'Follow-ups cannot be changed in demo mode. Sign in with Google to edit them.';

/** The follow-up plan of a programme, in order (inactive steps included). */
export async function fetchFollowupPlan(courseId: string): Promise<FollowupStep[]> {
  if (isDemoMode()) {
    return sortSteps(DEMO_FOLLOWUP_STEPS.filter((s) => s.course_id === courseId));
  }
  const { data, error } = await supabase.from('followup_steps').select('*').eq('course_id', courseId);
  if (error) throw new Error(error.message);
  return sortSteps((data as FollowupStep[]) || []);
}

export async function saveStep(
  orgId: string,
  courseId: string,
  userId: string,
  input: StepInput
): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: DEMO_EDIT_ERROR };
  const row = {
    kind: input.kind,
    title: input.title.trim(),
    description: input.description.trim() || null,
    offset_day: input.offset_day,
    sort_order: input.sort_order,
    is_active: input.is_active,
    updated_at: new Date().toISOString(),
  };
  const { error } = input.id
    ? await supabase.from('followup_steps').update(row).eq('id', input.id)
    : await supabase.from('followup_steps').insert({ ...row, org_id: orgId, course_id: courseId, created_by: userId });
  return error ? { success: false, error: error.message } : { success: true };
}

/** Deletes a plan step and everything recorded for it in every batch. */
export async function deleteStep(stepId: string): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: DEMO_EDIT_ERROR };
  const { error } = await supabase.from('followup_steps').delete().eq('id', stepId);
  return error ? { success: false, error: error.message } : { success: true };
}

/** Everything recorded for a batch (teacher and admin only). */
export async function fetchBatchFollowupRecords(batchId: string): Promise<FollowupRecord[]> {
  if (isDemoMode()) return [];
  const { data, error } = await supabase.from('followup_records').select('*').eq('batch_id', batchId);
  if (error) throw new Error(error.message);
  return (data as FollowupRecord[]) || [];
}

export interface RecordInput {
  batchId: string;
  stepId: string;
  /** null for a session */
  studentId: string | null;
  status: FollowupRecordStatus;
  scheduledFor?: string | null;
  location?: string | null;
  notes?: string | null;
}

/** Creates or updates the one record for a session or for one student's personal follow-up. */
export async function saveRecord(orgId: string, userId: string, input: RecordInput): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: DEMO_EDIT_ERROR };
  const { error } = await supabase.from('followup_records').upsert(
    {
      org_id: orgId,
      batch_id: input.batchId,
      step_id: input.stepId,
      student_id: input.studentId,
      status: input.status,
      scheduled_for: input.scheduledFor ?? null,
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'batch_id,step_id,student_id' }
  );
  return error ? { success: false, error: error.message } : { success: true };
}

/** Clears a record (back to "not done yet"). */
export async function deleteRecord(recordId: string): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: false, error: DEMO_EDIT_ERROR };
  const { error } = await supabase.from('followup_records').delete().eq('id', recordId);
  return error ? { success: false, error: error.message } : { success: true };
}

/** Follow-up sessions of the student's batch: title, day, when, where, status (no teacher notes). */
export async function fetchMyBatchSessions(batchId: string): Promise<BatchSession[]> {
  if (isDemoMode()) {
    return DEMO_FOLLOWUP_STEPS.filter((s) => s.kind === 'session').map((s) => ({
      step_id: s.id,
      title: s.title,
      description: s.description,
      offset_day: s.offset_day,
      status: null,
      scheduled_for: null,
      location: null,
    }));
  }
  const { data, error } = await supabase.rpc('my_batch_sessions', { p_batch_id: batchId });
  if (error) throw new Error(error.message);
  return (data as BatchSession[]) || [];
}
