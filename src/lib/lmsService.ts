import { fetchAllPages } from './paging';
import { supabase } from './supabase';
import type { Lesson, LessonModule, LessonProgress } from '../types/database';
import { sortByDisplayOrder, type LessonInput, type ModuleInput } from './lmsUtils';


/**
 * Modules of a programme with their lessons, in display order.
 * Students only receive published modules and the lessons of open modules
 * (row level security); staff receive everything.
 */
export async function fetchProgrammeModules(courseId: string): Promise<LessonModule[]> {

  const { data, error } = await supabase
    .from('lesson_modules')
    .select('*, lessons(*)')
    .eq('course_id', courseId);
  if (error) {
    throw new Error(error.message);
  }
  return sortByDisplayOrder((data as LessonModule[]) || []).map((m) => ({
    ...m,
    lessons: sortByDisplayOrder((m.lessons as Lesson[]) || []),
  }));
}

/** Lesson ids the student has completed. */
export async function fetchMyLessonProgress(studentId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('lesson_progress').select('lesson_id').eq('student_id', studentId);
  if (error) {
    throw new Error(error.message);
  }
  return new Set(((data as Pick<LessonProgress, 'lesson_id'>[]) || []).map((p) => p.lesson_id));
}

/** Marks a lesson as completed (done = true) or not completed. */
export async function setLessonComplete(
  orgId: string,
  studentId: string,
  lessonId: string,
  done: boolean
): Promise<{ success: boolean; error?: string }> {

  const { error } = done
    ? await supabase
        .from('lesson_progress')
        .upsert({ org_id: orgId, student_id: studentId, lesson_id: lessonId }, { onConflict: 'student_id,lesson_id' })
    : await supabase.from('lesson_progress').delete().eq('student_id', studentId).eq('lesson_id', lessonId);
  return error ? { success: false, error: error.message } : { success: true };
}

/**
 * Completed lessons per student, for a teacher's roster
 * (row level security returns only the teacher's own students).
 */
export async function fetchStudentsLessonProgress(studentIds: string[]): Promise<Map<string, Set<string>>> {
  const byStudent = new Map<string, Set<string>>();
  if (studentIds.length === 0) {
    return byStudent;
  }
  // 60 students x 20 lessons is already more than one page of 1,000 rows
  const data = await fetchAllPages<Pick<LessonProgress, 'student_id' | 'lesson_id'>>((from, to) =>
    supabase
      .from('lesson_progress')
      .select('student_id, lesson_id')
      .in('student_id', studentIds)
      .order('student_id', { ascending: true })
      .order('lesson_id', { ascending: true })
      .range(from, to)
  );
  for (const row of data) {
    if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, new Set());
    byStudent.get(row.student_id)!.add(row.lesson_id);
  }
  return byStudent;
}


export async function saveModule(
  orgId: string,
  courseId: string,
  userId: string,
  input: ModuleInput
): Promise<{ success: boolean; error?: string }> {

  const row = {
    title: input.title.trim(),
    description: input.description.trim() || null,
    sort_order: input.sort_order,
    unlock_rule: input.unlock_rule,
    unlock_day: input.unlock_rule === 'day' ? input.unlock_day : null,
    published: input.published,
    updated_at: new Date().toISOString(),
  };
  const { error } = input.id
    ? await supabase.from('lesson_modules').update(row).eq('id', input.id)
    : await supabase.from('lesson_modules').insert({ ...row, org_id: orgId, course_id: courseId, created_by: userId });
  return error ? { success: false, error: error.message } : { success: true };
}

/** Deletes a module and, with it, its lessons and everyone's progress on them. */
export async function deleteModule(moduleId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('lesson_modules').delete().eq('id', moduleId);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function saveLesson(
  orgId: string,
  courseId: string,
  moduleId: string,
  userId: string,
  input: LessonInput
): Promise<{ success: boolean; error?: string }> {

  const row = {
    title: input.title.trim(),
    body: input.body,
    video_url: input.video_url.trim() || null,
    estimated_minutes: input.estimated_minutes,
    sort_order: input.sort_order,
    published: input.published,
    updated_at: new Date().toISOString(),
  };
  const { error } = input.id
    ? await supabase.from('lessons').update(row).eq('id', input.id)
    : await supabase.from('lessons').insert({
        ...row,
        org_id: orgId,
        scope: 'course',
        course_id: courseId,
        module_id: moduleId,
        author_id: userId,
      });
  return error ? { success: false, error: error.message } : { success: true };
}

export async function deleteLesson(lessonId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
  return error ? { success: false, error: error.message } : { success: true };
}
