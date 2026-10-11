import { supabase, isDemoMode } from './supabase';
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
 * Sample data is used only in the 1-click demo mode.
 */
export async function fetchStudentCheckins(
  batchId: string,
  studentId: string
): Promise<Checkin[]> {
  if (isDemoMode()) {
    return getDemoCheckinsForStudent(studentId, batchId);
  }

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
 * Sample data is used only in the 1-click demo mode.
 */
export async function fetchBatchCheckins(batchId: string): Promise<Checkin[]> {
  if (isDemoMode()) {
    return getDemoBatchCheckins();
  }

  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('batch_id', batchId)
    .order('day_number', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return (data as Checkin[]) || [];
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
  if (isDemoMode()) {
    const all = await fetchStudentCheckins(batchId, studentId);
    return all.find((c) => c.day_number === dayNumber) || null;
  }

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

  const persistToLocal = (item: Checkin) => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const nextList = [...currentList];
        const idx = nextList.findIndex((c) => c.day_number === dayNumber);
        if (idx >= 0) {
          nextList[idx] = item;
        } else {
          nextList.push(item);
        }
        localStorage.setItem(storageKey, JSON.stringify(nextList));
      } catch {
        // ignore
      }
    }
  };

  // Demo mode has no database session: keep the answer on this device only
  if (isDemoMode()) {
    persistToLocal(updatedCheckin);
    return { success: true, checkin: updatedCheckin, data: updatedCheckin };
  }

  // Persist to Supabase checkins table with onConflict
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
      persistToLocal(data as Checkin);
      return { success: true, checkin: data as Checkin, data: data as Checkin };
    }
    if (error) {
      console.warn('saveDailyCheckin error:', error);
      return { success: false, error: error.message };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database checkin error';
    return { success: false, error: msg };
  }

  return { success: false, error: 'Check-in was not saved' };
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
