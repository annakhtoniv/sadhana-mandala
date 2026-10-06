import { supabase } from './supabase';
import type { Checkin, CheckinStatus } from '../types/database';

/**
 * Calculates the practice streak for a student.
 * Rules per SPEC.md:
 * - Consecutive "done" days.
 * - A rest day neither adds to nor breaks the streak.
 * - A passed day with "not_yet" or no answer breaks it.
 * - If today (currentDay) is not answered yet, today is still in progress,
 *   so streak achieved up to yesterday remains active.
 */
export function calculateStreak(
  checkins: { day_number: number; status: CheckinStatus }[],
  currentDay: number
): number {
  if (currentDay < 1) return 0;

  // Map day numbers to statuses
  const statusMap = new Map<number, CheckinStatus>();
  for (const c of checkins) {
    statusMap.set(c.day_number, c.status);
  }

  let streak = 0;
  const todayStatus = statusMap.get(currentDay);

  let startCheckingDay: number;

  if (todayStatus === 'done') {
    streak = 1;
    startCheckingDay = currentDay - 1;
  } else if (todayStatus === 'rest') {
    // Rest day neither adds nor breaks, inspect preceding days
    streak = 0;
    startCheckingDay = currentDay - 1;
  } else if (todayStatus === 'not_yet') {
    // Answered "not yet" today
    return 0;
  } else {
    // No answer for today yet: today has not passed, so streak from yesterday is active
    streak = 0;
    startCheckingDay = currentDay - 1;
  }

  // Walk backwards from startCheckingDay to Day 1
  for (let d = startCheckingDay; d >= 1; d--) {
    const status = statusMap.get(d);

    if (status === 'done') {
      streak += 1;
    } else if (status === 'rest') {
      // Rest day: neither adds nor breaks streak
      continue;
    } else {
      // Missing check-in or 'not_yet' on a passed day breaks the streak
      break;
    }
  }

  return streak;
}

/**
 * Checks if a student is "Quiet".
 * Rules per SPEC.md:
 * - Quiet: no check-in of any kind for 4 consecutive days.
 * - If fewer than 4 days have elapsed in the batch, student cannot be quiet.
 */
export function isStudentQuiet(
  checkins: { day_number: number }[],
  currentDay: number
): boolean {
  if (currentDay < 4) return false;

  const recordedDays = new Set(checkins.map((c) => c.day_number));

  // If student checked in today, they are active, not quiet!
  if (recordedDays.has(currentDay)) {
    return false;
  }

  // Count consecutive missed days backwards from currentDay
  let consecutiveMissed = 0;
  for (let d = currentDay; d >= 1; d--) {
    if (!recordedDays.has(d)) {
      consecutiveMissed++;
      if (consecutiveMissed >= 4) {
        return true;
      }
    } else {
      break;
    }
  }

  return false;
}

/**
 * Fetches all checkins for a specific student in a batch.
 */
export async function fetchStudentCheckins(
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
      console.error('Error fetching student checkins:', error);
      return [];
    }

    return (data as Checkin[]) || [];
  } catch (err) {
    console.error('Unexpected error fetching checkins:', err);
    return [];
  }
}

/**
 * Fetches all checkins for an entire batch (used by teacher roster).
 */
export async function fetchBatchCheckins(batchId: string): Promise<Checkin[]> {
  try {
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('batch_id', batchId);

    if (error) {
      console.error('Error fetching batch checkins:', error);
      return [];
    }

    return (data as Checkin[]) || [];
  } catch (err) {
    console.error('Unexpected error fetching batch checkins:', err);
    return [];
  }
}

/**
 * Saves or updates a daily check-in (Done / Not yet / Rest day).
 * Enforces upsert: tapping twice updates the row, never duplicates it.
 */
export async function recordCheckin(
  orgId: string,
  batchId: string,
  studentId: string,
  dayNumber: number,
  status: CheckinStatus
): Promise<{ success: boolean; checkin?: Checkin; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('checkins')
      .upsert(
        {
          org_id: orgId,
          batch_id: batchId,
          student_id: studentId,
          day_number: dayNumber,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,batch_id,day_number' }
      )
      .select()
      .single();

    if (error) {
      console.error('Failed to record checkin:', error);
      return { success: false, error: error.message };
    }

    return { success: true, checkin: data as Checkin };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}
