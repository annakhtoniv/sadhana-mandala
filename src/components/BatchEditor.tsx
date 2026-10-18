import React, { useEffect, useState } from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { fetchCourses, generateJoinCode, updateBatch } from '../lib/batchService';
import type { Batch, Course, Profile } from '../types/database';
import { AlertTriangle, X } from 'lucide-react';

interface BatchEditorProps {
  batch: Batch;
  orgId: string;
  /** Admins can give the batch to another teacher */
  canChangeTeacher: boolean;
  onClose: () => void;
  onSaved: (batch: Batch) => void;
}

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 focus:outline-none';
const labelClass = 'block text-xs font-medium text-stone-600 mb-1';

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
    if (canChangeTeacher && !isDemoMode()) {
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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-3 bg-stone-950/40 backdrop-blur-sm animate-fade-up">
      <form onSubmit={save} className="ui-card w-full max-w-md space-y-3.5 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <span className="ui-eyebrow">Edit batch</span>
            <h2 className="font-display text-lg font-semibold text-stone-950 mt-2">{batch.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="ui-icon-btn" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

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
          <p className="text-[11px] text-amber-700 flex gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            A new start date moves every day of the batch. This is only possible before anyone has checked in.
          </p>
        )}
        {form.joinCode !== batch.join_code && (
          <p className="text-[11px] text-amber-700 flex gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            Printed QR codes and shared links with the old code stop working.
          </p>
        )}
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="ui-btn-ghost !py-2.5">Cancel</button>
          <button type="submit" disabled={saving} className="ui-btn-primary !py-2.5">{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
};
