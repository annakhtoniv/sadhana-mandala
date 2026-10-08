import { supabase } from './supabase';
import type { Checkin, CheckinStatus } from '../types/database';

/**
 * Fetches all check-in records for a student in a specific batch.
 */
export async function fetchStudentBatchCheckins(
  batchId: string,
  studentId: string
): Promise<Checkin[]> {
  try {
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('batch_id', batchId)
      .eq('student_id', studentId)
      .order('day_number', { ascending: true });

    if (error) {
      console.warn('fetchStudentBatchCheckins note:', error.message);
      return [];
    }

    return (data as Checkin[]) || [];
  } catch (err) {
    console.error('Error fetching student checkins:', err);
    return [];
  }
}

/**
 * Fetches today's check-in for a student in a batch.
 */
export async function fetchTodayCheckin(
  batchId: string,
  studentId: string,
  dayNumber: number
): Promise<Checkin | null> {
  try {
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('batch_id', batchId)
      .eq('student_id', studentId)
      .eq('day_number', dayNumber)
      .maybeSingle();

    if (error) {
      console.warn('fetchTodayCheckin note:', error.message);
      return null;
    }

    return (data as Checkin) || null;
  } catch (err) {
    console.error('Error fetching today checkin:', err);
    return null;
  }
}

/**
 * Saves or updates a daily check-in row.
 *
 * Business Rules (per SPEC.md):
 * - Students can check in for today only, determined by batch.start_date in org timezone.
 * - Tapping twice or changing answer updates the row for today, never duplicates it.
 * - Uses onConflict: 'student_id,batch_id,day_number'.
 */
export async function saveDailyCheckin(params: {
  orgId: string;
  batchId: string;
  studentId: string;
  dayNumber: number;
  status: CheckinStatus;
}): Promise<{ success: boolean; data?: Checkin; error?: string }> {
  try {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('checkins')
      .upsert(
        {
          org_id: params.orgId,
          batch_id: params.batchId,
          student_id: params.studentId,
          day_number: params.dayNumber,
          status: params.status,
          updated_at: nowIso,
        },
        {
          onConflict: 'student_id,batch_id,day_number',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('saveDailyCheckin error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Checkin };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to record check-in';
    return { success: false, error: msg };
  }
}

/**
 * Fetches all check-ins for all students in a batch (for teacher dashboards).
 */
export async function fetchBatchAllCheckins(batchId: string): Promise<Checkin[]> {
  try {
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('batch_id', batchId)
      .order('day_number', { ascending: true });

    if (error) {
      console.warn('fetchBatchAllCheckins note:', error.message);
      return [];
    }

    return (data as Checkin[]) || [];
  } catch (err) {
    console.error('Error fetching batch checkins:', err);
    return [];
  }
}
