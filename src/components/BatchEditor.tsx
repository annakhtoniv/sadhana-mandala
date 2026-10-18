import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchCourses, generateJoinCode, updateBatch } from '../lib/batchService';
import type { Batch, Course, Profile } from '../types/database';
import { AlertTriangle } from 'lucide-react';
import { Sheet } from './Sheet';

interface BatchEditorProps {
  batch: Batch;
  orgId: string;
  /** Admins can give the batch to another teacher */
  canChangeTeacher: boolean;
  onClose: () => void;
  onSaved: (batch: Batch) => void;
}

const inputClass = 'ui-input';
const labelClass = 'ui-label';

/** Edit a batch: name, programme, teacher (admins), start date and join code. */
export const BatchEditor: React.FC<BatchEditorProps> = ({ batch, orgId, canChangeTeacher, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: batch.name,
    courseId: batch.course_id,
    teacherId: batch.teacher_id,
    startDate: batch.start_date,
    joinCode: batch.join_code,
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Pick<Profile, 'id' | 'full_name' | 'email' | 'role'>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCourses(orgId).then(setCourses).catch(() => setCourses([]));
    if (canChangeTeacher) {
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('org_id', orgId)
        .in('role', ['teacher', 'admin'])
        .order('full_name')
        .then(({ data }) => setTeachers((data as typeof teachers) || []));
    }
  }, [orgId, canChangeTeacher]);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateBatch(batch.id, form);
    setSaving(false);
    if (!res.success || !res.data) {
      setError(res.error || 'Could not save.');
      return;
    }
    onSaved(res.data);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Edit batch"
      description={batch.name}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} className="ui-btn-ghost">Cancel</button>
          <button type="submit" form="batch-editor" disabled={saving} className="ui-btn-primary">{saving ? 'Saving...' : 'Save changes'}</button>
        </>
      }
    >
      <form id="batch-editor" onSubmit={save} className="space-y-3.5">
        <div>
          <label className={labelClass} htmlFor="be-name">Batch name</label>
          <input id="be-name" className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="be-course">Programme</label>
          <select id="be-course" className={inputClass} value={form.courseId} onChange={(e) => set('courseId', e.target.value)}>
            {courses.length === 0 && <option value={batch.course_id}>{batch.course?.name || 'Current programme'}</option>}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {canChangeTeacher && (
          <div>
            <label className={labelClass} htmlFor="be-teacher">Teacher</label>
            <select id="be-teacher" className={inputClass} value={form.teacherId} onChange={(e) => set('teacherId', e.target.value)}>
              {!teachers.some((t) => t.id === batch.teacher_id) && (
                <option value={batch.teacher_id}>{batch.teacher?.full_name || batch.teacher?.email || 'Current teacher'}</option>
              )}
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name || t.email} ({t.role})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={labelClass} htmlFor="be-start">Start date (day 1)</label>
            <input id="be-start" type="date" className={inputClass} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="be-code">Join code</label>
            <div className="flex gap-1.5">
              <input
                id="be-code"
                className={`${inputClass} font-mono uppercase tracking-wider bg-stone-50`}
                value={form.joinCode}
                readOnly
              />
              <button
                type="button"
                onClick={() => set('joinCode', generateJoinCode())}
                className="ui-btn-ghost !px-3 shrink-0"
                title="Make a new random code (the old QR and links stop working)"
              >
                New code
              </button>
            </div>
          </div>
        </div>

        {form.startDate !== batch.start_date && (
          <p className="text-xs text-amber-700 flex gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            A new start date moves every day of the batch. This is only possible before anyone has checked in.
          </p>
        )}
        {form.joinCode !== batch.join_code && (
          <p className="text-xs text-amber-700 flex gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            Printed QR codes and shared links with the old code stop working.
          </p>
        )}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </form>
    </Sheet>
  );
};
