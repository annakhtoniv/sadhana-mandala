import { supabase } from './supabase';
import type { Checkin, CheckinStatus } from '../types/database';
import { getDemoCheckinsForStudent, getDemoBatchCheckins } from './mockData';
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
 * Queries Supabase first, falling back to local demo data if unseeded.
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

    if (!error && data && data.length > 0) {
      return data as Checkin[];
    }
  } catch (err) {
    console.warn('Note: using student check-in fallback:', err);
  }

  return getDemoCheckinsForStudent(studentId, batchId);
}

// Alias for fetchStudentCheckins
export const fetchStudentBatchCheckins = fetchStudentCheckins;

/**
 * Fetches all checkins for an entire batch (used by teacher roster).
 * Queries Supabase first, falling back to full cohort demo checkins.
 */
export async function fetchBatchCheckins(batchId: string): Promise<Checkin[]> {
  try {
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('batch_id', batchId)
      .order('day_number', { ascending: true });

    if (!error && data && data.length > 0) {
      return data as Checkin[];
    }
  } catch (err) {
    console.warn('Note: using batch check-ins fallback:', err);
  }

  return getDemoBatchCheckins();
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
  try {
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('batch_id', batchId)
      .eq('student_id', studentId)
      .eq('day_number', dayNumber)
      .maybeSingle();

    if (!error && data) {
      return data as Checkin;
    }
  } catch (err) {
    console.warn('fetchTodayCheckin note:', err);
  }

  const all = await fetchStudentCheckins(batchId, studentId);
  return all.find((c) => c.day_number === dayNumber) || null;
}

/**
 * Saves or updates a daily check-in (Done / Not yet / Rest day).
 * Enforces upsert matching unique(student_id, batch_id, day_number).
 * Tapping twice or changing answer updates the row, never duplicates it.
 */
export async function recordCheckin(
  orgId: string,
  batchId: string,
  studentId: string,
  dayNumber: number,
  status: CheckinStatus
): Promise<{ success: boolean; checkin?: Checkin; data?: Checkin; error?: string }> {
  const nowIso = new Date().toISOString();

  // 1. Immediately update localStorage for 100% reliable preview/offline feedback
  const storageKey = `sadhana_checkins_${studentId}_${batchId}`;
  let currentList: Checkin[] = [];
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        currentList = JSON.parse(raw);
      } else {
        currentList = getDemoCheckinsForStudent(studentId, batchId);
      }
    } catch {
      currentList = getDemoCheckinsForStudent(studentId, batchId);
    }
  } else {
    currentList = getDemoCheckinsForStudent(studentId, batchId);
  }

  const existingIdx = currentList.findIndex((c) => c.day_number === dayNumber);
  const updatedCheckin: Checkin = {
    id: existingIdx >= 0 ? currentList[existingIdx].id : `chk-${studentId}-${dayNumber}-${Date.now()}`,
    org_id: orgId,
    batch_id: batchId,
    student_id: studentId,
    day_number: dayNumber,
    status,
    created_at: existingIdx >= 0 ? currentList[existingIdx].created_at : nowIso,
    updated_at: nowIso,
  };

  if (existingIdx >= 0) {
    currentList[existingIdx] = updatedCheckin;
  } else {
    currentList.push(updatedCheckin);
  }

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(storageKey, JSON.stringify(currentList));
    } catch {
      // ignore
    }
  }

  // 2. Persist to Supabase checkins table with onConflict
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
          updated_at: nowIso,
        },
        { onConflict: 'student_id,batch_id,day_number' }
      )
      .select()
      .single();

    if (!error && data) {
      return { success: true, checkin: data as Checkin, data: data as Checkin };
    }
    if (error) {
      console.warn('saveDailyCheckin error:', error);
      return { success: false, error: error.message };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database checkin error';
    console.warn('Note: Check-in saved locally, Supabase note:', msg);
  }

  return { success: true, checkin: updatedCheckin, data: updatedCheckin };
}

// Alias matching saveDailyCheckin
export const saveDailyCheckin = async (params: {
  orgId: string;
  batchId: string;
  studentId: string;
  dayNumber: number;
  status: CheckinStatus;
}) => {
  return recordCheckin(
    params.orgId,
    params.batchId,
    params.studentId,
    params.dayNumber,
    params.status
  );
};
