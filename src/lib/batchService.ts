import { friendlyError } from './errors';
import { getResolvedOrgSlug } from './organisation';
import { supabase, isSupabaseConfigured } from './supabase';
import { sortProgrammes } from './programmeUtils';
import type { Batch, BatchJoinPreview, Course, Enrolment, BatchInvite } from '../types/database';

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

const BATCH_SELECT = `
  id,
  org_id,
  course_id,
  teacher_id,
  name,
  start_date,
  join_code,
  created_at,
  course:courses(*),
  teacher:profiles(id, full_name, email, avatar_url)
`;

/** Letters and digits that cannot be mistaken for each other (no 0/O, 1/I). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A new join code: 8 characters from a cryptographic random source (not guessable). */
export function generateJoinCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** Join codes are 4 to 12 capital letters or digits (the same rule as the database). */
export function isValidJoinCode(code: string): boolean {
  return /^[A-Z0-9]{4,12}$/.test(code);
}

function parseEmailList(rawEmailsText: string): string[] {
  return rawEmailsText
    .split(/[\n,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e && e.includes('@'));
}

/**
 * Every programme the user is enrolled in, newest first
 * (SPEC: a student can be in many programmes over time).
 */
export async function fetchUserEnrolments(userId: string): Promise<Enrolment[]> {

  const { data, error } = await supabase
    .from('enrolments')
    .select(`
      id,
      org_id,
      batch_id,
      student_id,
      source,
      joined_at,
      batch:batches(${BATCH_SELECT})
    `)
    .eq('student_id', userId)
    .order('joined_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return (data as unknown as Enrolment[]) || [];
}

/**
 * Joins a batch via join code.
 * As per SPEC: "A join code works only inside its own organisation." (enforced by the RPC)
 */
export async function joinBatchByCode(joinCode: string): Promise<{
  success: boolean;
  message?: string;
  data?: any;
}> {
  const cleanCode = joinCode.trim().toUpperCase();

  const { data, error } = await supabase.rpc('join_batch_by_code', { p_join_code: cleanCode });
  if (error) {
    return { success: false, message: error.message };
  }
  if (data?.success === false) {
    return { success: false, message: data.message || 'Invalid join code. Please check with your teacher.' };
  }
  return { success: true, data };
}

/**
 * Fetches batches for a teacher (own batches), or every batch in the organisation for an admin.
 * Row level security limits the result to the user's organisation.
 */
export async function fetchTeacherBatches(
  teacherId: string,
  isAdmin: boolean = false
): Promise<Batch[]> {

  let query = supabase.from('batches').select(BATCH_SELECT).order('start_date', { ascending: false });
  if (!isAdmin) {
    query = query.eq('teacher_id', teacherId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return (data as unknown as Batch[]) || [];
}

/**
 * Creates a new batch with a new random join code (codes are never typed by
 * hand, so they cannot be guessed).
 */
export async function createBatch(params: {
  orgId: string;
  courseId: string;
  teacherId: string;
  name: string;
  startDate: string;
}): Promise<{ success: boolean; data?: Batch; error?: string }> {
  let joinCode = generateJoinCode();
  const startDate = params.startDate || new Date().toISOString().split('T')[0];

  if (!params.orgId || !params.courseId || !params.teacherId) {
    return { success: false, error: 'Please choose a course before creating a batch.' };
  }

  const insert = () =>
    supabase
      .from('batches')
      .insert({
        org_id: params.orgId,
        course_id: params.courseId,
        teacher_id: params.teacherId,
        name: params.name,
        start_date: startDate,
        join_code: joinCode,
      })
      .select(BATCH_SELECT)
      .single();

  let { data, error } = await insert();
  if (error?.code === '23505') {
    // Two batches drew the same code (very rare): draw again
    joinCode = generateJoinCode();
    ({ data, error } = await insert());
  }
  if (error) return { success: false, error: friendlyError(error) };
  return { success: true, data: data as unknown as Batch };
}

/**
 * Edits a batch. Admins may change everything; a teacher only their own
 * batches (enforced by the database). Changing the start date moves every
 * day number of the batch.
 */
export async function updateBatch(
  batchId: string,
  changes: { name: string; courseId: string; teacherId: string; startDate: string; joinCode: string }
): Promise<{ success: boolean; data?: Batch; error?: string }> {
  const joinCode = changes.joinCode.trim().toUpperCase();
  if (!changes.name.trim()) return { success: false, error: 'Please enter a batch name.' };
  if (!isValidJoinCode(joinCode)) return { success: false, error: 'The join code needs 4 to 12 letters or numbers.' };
  if (!changes.startDate) return { success: false, error: 'Please choose a start date.' };

  // Day numbers count from the start date: once students have ticked, moving the
  // start date or changing the programme would move their ticks to other days
  const { data: current } = await supabase.from('batches').select('start_date, course_id').eq('id', batchId).maybeSingle();
  if (current && (current.start_date !== changes.startDate || current.course_id !== changes.courseId)) {
    const { count } = await supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('batch_id', batchId);
    if ((count || 0) > 0) {
      return {
        success: false,
        error: 'Students have already checked in, so the start date and programme of this batch can no longer change.',
      };
    }
  }

  const { data, error } = await supabase
    .from('batches')
    .update({
      name: changes.name.trim(),
      course_id: changes.courseId,
      teacher_id: changes.teacherId,
      start_date: changes.startDate,
      join_code: joinCode,
    })
    .eq('id', batchId)
    .select(BATCH_SELECT)
    .single();

  if (error) {
    if (error.code === '23505') return { success: false, error: 'That join code is taken. Tap "New code" again.' };
    if (error.code === 'PGRST116') return { success: false, error: 'You can only change batches you teach.' };
    return { success: false, error: friendlyError(error) };
  }
  return { success: true, data: data as unknown as Batch };
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
  const emailList = parseEmailList(rawEmailsText);
  if (emailList.length === 0) {
    return { success: false, error: 'No valid email addresses found' };
  }

  const { data, error } = await supabase.rpc('add_batch_invites', {
    p_batch_id: batchId,
    p_emails: emailList,
  });
  if (error) {
    return { success: false, error: error.message };
  }
  return {
    success: true,
    totalInvites: data?.total_invites ?? emailList.length,
    totalAutoEnrolled: data?.total_auto_enrolled ?? 0,
  };
}

/**
 * Fetches enrolled students in a batch, with their profiles.
 */
export async function fetchBatchEnrolments(batchId: string): Promise<Enrolment[]> {

  const { data, error } = await supabase
    .from('enrolments')
    .select(`
      id,
      org_id,
      batch_id,
      student_id,
      source,
      joined_at,
      student:profiles(id, email, full_name, avatar_url)
    `)
    .eq('batch_id', batchId)
    .order('joined_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return (data as unknown as Enrolment[]) || [];
}

/**
 * Fetches invites for a batch.
 */
export async function fetchBatchInvites(batchId: string): Promise<BatchInvite[]> {

  const { data, error } = await supabase
    .from('batch_invites')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return (data as BatchInvite[]) || [];
}

/**
 * Active programmes of an organisation, in catalogue order
 * (used when creating a batch).
 */
export async function fetchCourses(orgId: string): Promise<Course[]> {

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('org_id', orgId);

  if (error) {
    throw new Error(error.message);
  }
  return sortProgrammes(((data as Course[]) || []).filter((c) => c.is_active !== false));
}

/**
 * Batch QR: which batch a join code belongs to, shown on the sign-in page
 * before the person signs in. Returns null when the code is unknown.
 */
export async function fetchBatchJoinPreview(joinCode: string): Promise<BatchJoinPreview | null> {
  const code = joinCode.trim().toUpperCase();
  if (!isSupabaseConfigured) return null;
  // Only batches of the organisation whose site this is (Phase 14)
  let { data, error } = await supabase.rpc('batch_join_preview', { p_code: code, p_org_slug: getResolvedOrgSlug() });
  if (error && /batch_join_preview|function/i.test(error.message)) {
    // Database not yet updated to Phase 14: the older preview without the organisation
    ({ data, error } = await supabase.rpc('batch_join_preview', { p_code: code }));
  }
  if (error) throw new Error(error.message);
  return (data as BatchJoinPreview | null) || null;
}
