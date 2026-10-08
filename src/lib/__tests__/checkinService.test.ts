import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveDailyCheckin, fetchStudentBatchCheckins, fetchTodayCheckin } from '../checkinService';
import { supabase } from '../supabase';

vi.mock('../supabase', () => {
  const fromMock = vi.fn();
  return {
    supabase: {
      from: fromMock,
    },
  };
});

describe('CheckinService Database Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saveDailyCheckin calls upsert with matching onConflict composite key', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'chk-1',
        org_id: 'org-1',
        batch_id: 'batch-1',
        student_id: 'student-1',
        day_number: 5,
        status: 'done',
        updated_at: '2026-10-08T08:00:00Z',
      },
      error: null,
    });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
    (supabase.from as any).mockReturnValue({ upsert: upsertMock });

    const result = await saveDailyCheckin({
      orgId: 'org-1',
      batchId: 'batch-1',
      studentId: 'student-1',
      dayNumber: 5,
      status: 'done',
    });

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('done');
    expect(supabase.from).toHaveBeenCalledWith('checkins');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        batch_id: 'batch-1',
        student_id: 'student-1',
        day_number: 5,
        status: 'done',
      }),
      { onConflict: 'student_id,batch_id,day_number' }
    );
  });

  it('saveDailyCheckin gracefully returns error when Supabase upsert fails', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
    });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
    (supabase.from as any).mockReturnValue({ upsert: upsertMock });

    const result = await saveDailyCheckin({
      orgId: 'org-1',
      batchId: 'batch-1',
      studentId: 'student-1',
      dayNumber: 5,
      status: 'not_yet',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database connection failed');
  });

  it('fetchStudentBatchCheckins queries and returns ordered check-ins', async () => {
    const mockData = [
      { id: '1', day_number: 1, status: 'done' },
      { id: '2', day_number: 2, status: 'rest' },
    ];
    const orderMock = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const eqStudentMock = vi.fn().mockReturnValue({ order: orderMock });
    const eqBatchMock = vi.fn().mockReturnValue({ eq: eqStudentMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqBatchMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const result = await fetchStudentBatchCheckins('batch-1', 'student-1');

    expect(result).toHaveLength(2);
    expect(supabase.from).toHaveBeenCalledWith('checkins');
    expect(eqBatchMock).toHaveBeenCalledWith('batch_id', 'batch-1');
    expect(eqStudentMock).toHaveBeenCalledWith('student_id', 'student-1');
    expect(orderMock).toHaveBeenCalledWith('day_number', { ascending: true });
  });

  it('fetchTodayCheckin finds single check-in for specific day', async () => {
    const mockToday = { id: '3', day_number: 10, status: 'done' };
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: mockToday, error: null });
    const eqDayMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const eqStudentMock = vi.fn().mockReturnValue({ eq: eqDayMock });
    const eqBatchMock = vi.fn().mockReturnValue({ eq: eqStudentMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqBatchMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const result = await fetchTodayCheckin('batch-1', 'student-1', 10);

    expect(result?.day_number).toBe(10);
    expect(result?.status).toBe('done');
    expect(eqDayMock).toHaveBeenCalledWith('day_number', 10);
  });
});
