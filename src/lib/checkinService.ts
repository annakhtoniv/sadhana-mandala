import { friendlyError } from './errors';
import { fetchAllPages } from './paging';
import { supabase } from './supabase';
import type { Checkin } from '../types/database';
import {
  calculateStreak as calcStreakUtil,
  isQuietStudent as isQuietStudentUtil,
  calculateDayNumber as calcDayNumUtil,
  getTrailDayStatus as getTrailStatusUtil,
  upsertCheckinInMemory as upsertUtil,
} from './practiceUtils';

// Re-export pure utilities so callers have a single clean source of truth
export const calculateStreak = calcStreakUtil;
export const isQuietStudent = isQuietStudentUtil;
export const isStudentQuiet = isQuietStudentUtil;
export const calculateDayNumber = calcDayNumUtil;
export const getTrailDayStatus = getTrailStatusUtil;
export const upsertCheckinInMemory = upsertUtil;

/**
 * Fetches all checkins for a specific student in a batch.
 */
export async function fetchStudentCheckins(
  batchId: string,
  studentId: string
): Promise<Checkin[]> {

  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('batch_id', batchId)
    .eq('student_id', studentId)
    .order('day_number', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return (data as Checkin[]) || [];
}

// Alias for fetchStudentCheckins
export const fetchStudentBatchCheckins = fetchStudentCheckins;

/**
 * Fetches all checkins for an entire batch (used by teacher roster).
 */
export async function fetchBatchCheckins(batchId: string): Promise<Checkin[]> {

  // A batch easily has more than 1,000 check-ins (30 students x 40 days): page through them
  return fetchAllPages<Checkin>((from, to) =>
    supabase
      .from('checkins')
      .select('*')
      .eq('batch_id', batchId)
      .order('day_number', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  );
}

// Alias for fetchBatchCheckins
export const fetchBatchAllCheckins = fetchBatchCheckins;

/**
 * Fetches today's check-in for a student in a batch.
 */
export async function fetchTodayCheckin(
  batchId: string,
  studentId: string,
  dayNumber: number
): Promise<Checkin | null> {

  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('batch_id', batchId)
    .eq('student_id', studentId)
    .eq('day_number', dayNumber)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as Checkin) || null;
}

/**
 * Saves ONE tick (Morning or Evening) of one day (today or any past day of
 * the batch). Only the tapped tick is sent, so a tick made on another device
 * or in another tab is never overwritten. One row per day.
 */
export async function recordCheckin(
  orgId: string,
  batchId: string,
  studentId: string,
  dayNumber: number,
  slot: 'morning' | 'evening',
  value: boolean
): Promise<{ success: boolean; checkin?: Checkin; data?: Checkin; error?: string; offline?: boolean }> {
  // The status column follows the ticks in the database (trigger)
  const { data, error } = await supabase
    .from('checkins')
    .upsert(
      {
        org_id: orgId,
        batch_id: batchId,
        student_id: studentId,
        day_number: dayNumber,
        [slot]: value,
      },
      { onConflict: 'student_id,batch_id,day_number' }
    )
    .select()
    .single();

  if (error) {
    // No connection: the caller keeps the tick on this phone and sends it later
    const offline =
      /Failed to fetch|NetworkError|Load failed|network/i.test(error.message || '') ||
      (typeof navigator !== 'undefined' && navigator.onLine === false);
    return { success: false, error: friendlyError(error), offline };
  }
  return { success: true, checkin: data as Checkin, data: data as Checkin };
}
