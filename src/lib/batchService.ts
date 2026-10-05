import { supabase } from './supabase';
import type { Batch, Course, Enrolment, BatchInvite } from '../types/database';

/**
 * Claims any unclaimed invites addressed to the user's email.
 * As per SPEC: "Check for unclaimed invites on every sign-in, not only the first."
 */
export async function claimUserInvites(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('claim_pending_invites');
    if (error) {
      console.warn('claim_pending_invites RPC note:', error.message);
      return 0;
    }
    return Number(data) || 0;
  } catch (err) {
    console.error('Error in claimUserInvites:', err);
    return 0;
  }
}

/**
 * Fetches the user's active enrolment in their organisation.
 */
export async function fetchUserEnrolment(userId: string): Promise<Enrolment | null> {
  try {
    const { data, error } = await supabase
      .from('enrolments')
      .select(`
        id,
        org_id,
        batch_id,
        student_id,
        source,
        joined_at,
        batch:batches(
          id,
          org_id,
          course_id,
          teacher_id,
          name,
          start_date,
          join_code,
          created_at,
          course:courses(
            id,
            org_id,
            name,
            description,
            duration_days,
            created_at
          ),
          teacher:profiles(
            id,
            full_name,
            email
          )
        )
      `)
      .eq('student_id', userId)
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('fetchUserEnrolment note:', error.message);
      return null;
    }

    return (data as unknown as Enrolment) ?? null;
  } catch (err) {
    console.error('Error fetching user enrolment:', err);
    return null;
  }
}

/**
 * Joins a batch via join code.
 * As per SPEC: "Fallback: the student enters the batch join code or scans its QR. A join code works only inside its own organisation."
 */
export async function joinBatchByCode(joinCode: string): Promise<{
  success: boolean;
  message?: string;
  data?: any;
}> {
  try {
    const { data, error } = await supabase.rpc('join_batch_by_code', {
      p_join_code: joinCode.trim().toUpperCase(),
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to join batch';
    return { success: false, message };
  }
}

/**
 * Fetches batches for a teacher (or all batches if admin).
 */
export async function fetchTeacherBatches(
  teacherId: string,
  isAdmin: boolean = false
): Promise<Batch[]> {
  try {
    let query = supabase
      .from('batches')
      .select(`
        id,
        org_id,
        course_id,
        teacher_id,
        name,
        start_date,
        join_code,
        created_at,
        course:courses(*),
        teacher:profiles(id, full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('teacher_id', teacherId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as unknown as Batch[]) || [];
  } catch (err) {
    console.error('Error fetching teacher batches:', err);
    return [];
  }
}

/**
 * Creates a new batch with an auto-generated unique 6-character code.
 */
export async function createBatch(params: {
  orgId: string;
  courseId: string;
  teacherId: string;
  name: string;
  startDate: string;
  joinCode?: string;
}): Promise<{ success: boolean; data?: Batch; error?: string }> {
  try {
    const joinCode =
      params.joinCode?.trim().toUpperCase() ||
      Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from('batches')
      .insert({
        org_id: params.orgId,
        course_id: params.courseId,
        teacher_id: params.teacherId,
        name: params.name,
        start_date: params.startDate,
        join_code: joinCode,
      })
      .select(`
        *,
        course:courses(*)
      `)
      .single();

    if (error) throw error;
    return { success: true, data: data as unknown as Batch };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create batch';
    return { success: false, error: msg };
  }
}

/**
 * Teacher invites students by pasting an email list.
 * Auto-enrols matching accounts immediately.
 */
export async function addBatchInvites(
  batchId: string,
  rawEmailsText: string
): Promise<{
  success: boolean;
  totalInvites?: number;
  totalAutoEnrolled?: number;
  error?: string;
}> {
  try {
    // Parse emails from comma, newline, or space separated string
    const emailList = rawEmailsText
      .split(/[\n,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes('@'));

    if (emailList.length === 0) {
      return { success: false, error: 'No valid email addresses found' };
    }

    const { data, error } = await supabase.rpc('add_batch_invites', {
      p_batch_id: batchId,
      p_emails: emailList,
    });

    if (error) throw error;

    return {
      success: true,
      totalInvites: data?.total_invites ?? emailList.length,
      totalAutoEnrolled: data?.total_auto_enrolled ?? 0,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to add batch invites';
    return { success: false, error: msg };
  }
}

/**
 * Fetches enrolled students in a batch.
 */
export async function fetchBatchEnrolments(batchId: string): Promise<Enrolment[]> {
  try {
    const { data, error } = await supabase
      .from('enrolments')
      .select(`
        id,
        org_id,
        batch_id,
        student_id,
        source,
        joined_at,
        student:profiles(id, email, full_name)
      `)
      .eq('batch_id', batchId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return (data as unknown as Enrolment[]) || [];
  } catch (err) {
    console.error('Error fetching batch enrolments:', err);
    return [];
  }
}

/**
 * Fetches invites for a batch.
 */
export async function fetchBatchInvites(batchId: string): Promise<BatchInvite[]> {
  try {
    const { data, error } = await supabase
      .from('batch_invites')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as BatchInvite[]) || [];
  } catch (err) {
    console.error('Error fetching batch invites:', err);
    return [];
  }
}

/**
 * Fetches available courses for an organisation.
 */
export async function fetchCourses(orgId: string): Promise<Course[]> {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data as Course[]) || [];
  } catch (err) {
    console.error('Error fetching courses:', err);
    return [];
  }
}

/**
 * Creates a new course in the organisation.
 */
export async function createCourse(params: {
  orgId: string;
  name: string;
  description: string;
  durationDays: number;
}): Promise<{ success: boolean; data?: Course; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('courses')
      .insert({
        org_id: params.orgId,
        name: params.name,
        description: params.description || null,
        duration_days: params.durationDays || 40,
      })
      .select('*')
      .single();

    if (error) throw error;
    return { success: true, data: data as Course };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create course';
    return { success: false, error: msg };
  }
}
