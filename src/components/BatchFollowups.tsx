import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { deleteRecord, fetchBatchFollowupRecords, fetchFollowupPlan, saveRecord } from '../lib/followupService';
import { countDue, REMINDER_VISIBLE_DAYS, stepProgress, type StepState } from '../lib/followupUtils';
import { isoToZonedInput, zonedInputToIso } from '../lib/dateUtils';
import type { Batch, Enrolment, FollowupRecord, FollowupRecordStatus, FollowupStep } from '../types/database';
import { KIND_ICON } from './FollowupPlanEditor';
import { Check, ChevronDown, ChevronRight, CircleSlash, ClipboardList } from 'lucide-react';

interface BatchFollowupsProps {
  batch: Batch;
  currentDay: number;
  enrolments: Enrolment[];
  timeZone: string;
}

const STATE_LABEL: Record<StepState, string> = {
  upcoming: 'Upcoming',
  due: 'To do',
  scheduled: 'Scheduled',
  done: 'Done',
  skipped: 'Skipped',
  shown: 'Shown to students',
};

const STATE_CLASS: Record<StepState, string> = {
  upcoming: 'bg-stone-100 text-stone-500',
  due: 'bg-amber-100 text-amber-700',
  scheduled: 'bg-indigo-100 text-indigo-700',
  done: 'bg-emerald-100 text-emerald-700',
  skipped: 'bg-stone-100 text-stone-500',
  shown: 'bg-stone-100 text-stone-500',
};

const inputClass = 'ui-input';

export function formatSessionTime(iso: string | null, timeZone: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return '';
  }
}

/**
 * Teacher view of a batch's follow-ups (SPEC "Follow-ups"): every step of the
 * programme's plan with its state; sessions are scheduled and marked held,
 * personal follow-ups are ticked off per student with private notes.
 */
export const BatchFollowups: React.FC<BatchFollowupsProps> = ({ batch, currentDay, enrolments, timeZone }) => {
  const { organisation, user } = useAuth();
  const [steps, setSteps] = useState<FollowupStep[]>([]);
  const [records, setRecords] = useState<FollowupRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openStepId, setOpenStepId] = useState<string | null>(null);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ when: '', location: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const studentIds = useMemo(() => enrolments.map((e) => e.student_id), [enrolments]);

  const load = async () => {
    try {
      const [plan, recs] = await Promise.all([fetchFollowupPlan(batch.course_id), fetchBatchFollowupRecords(batch.id)]);
      setSteps(plan.filter((s) => s.is_active));
      setRecords(recs);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load follow-ups');
    }
  };

  useEffect(() => {
    load();
  }, [batch.id, batch.course_id]);

  const dueCount = countDue(steps, currentDay, records, studentIds);

  const recordFor = (stepId: string, studentId: string | null) =>
    records.find((r) => r.step_id === stepId && r.student_id === studentId) || null;

  const openStep = (step: FollowupStep) => {
    const next = openStepId === step.id ? null : step.id;
    setOpenStepId(next);
    setOpenStudentId(null);
    setSaveError(null);
    if (next && step.kind === 'session') {
      const r = recordFor(step.id, null);
      setDraft({ when: isoToZonedInput(r?.scheduled_for ?? null, timeZone), location: r?.location || '', notes: r?.notes || '' });
    }
  };

  const openStudent = (step: FollowupStep, studentId: string) => {
    const next = openStudentId === studentId ? null : studentId;
    setOpenStudentId(next);
    setSaveError(null);
    if (next) setDraft({ when: '', location: '', notes: recordFor(step.id, studentId)?.notes || '' });
  };

  const save = async (step: FollowupStep, studentId: string | null, status: FollowupRecordStatus) => {
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    const res = await saveRecord(organisation.id, user.id, {
      batchId: batch.id,
      stepId: step.id,
      studentId,
      status,
      scheduledFor: studentId === null && draft.when ? zonedInputToIso(draft.when, timeZone) : null,
      location: studentId === null ? draft.location : null,
      notes: draft.notes,
    });
    setSaving(false);
    if (!res.success) {
      setSaveError(res.error || 'Could not save.');
      return;
    }
    if (studentId) setOpenStudentId(null);
    await load();
  };

  const clear = async (record: FollowupRecord) => {
    setSaving(true);
    const res = await deleteRecord(record.id);
    setSaving(false);
    if (!res.success) {
      setSaveError(res.error || 'Could not clear.');
      return;
    }
    setOpenStudentId(null);
    setDraft({ when: '', location: '', notes: '' });
    await load();
  };

  const quickToggle = async (step: FollowupStep, studentId: string) => {
    const r = recordFor(step.id, studentId);
    if (r) await clear(r);
    else {
      setDraft({ when: '', location: '', notes: '' });
      await save(step, studentId, 'done');
    }
  };

  if (steps.length === 0 && !loadError) return null;

  return (
    <div id="tour-followups" className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-stone-500" />
          <h2 className="text-sm font-semibold text-stone-900">Follow-ups</h2>
        </div>
        {dueCount > 0 ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
            {dueCount} to do
          </span>
        ) : (
          <span className="text-xs text-stone-500">Nothing due</span>
        )}
      </div>

      {loadError && <p className="text-xs text-red-600">Could not load follow-ups: {loadError}</p>}

      <div className="divide-y divide-stone-100">
        {steps.map((step) => {
          const Icon = KIND_ICON[step.kind];
          const progress = stepProgress(step, currentDay, records, studentIds);
          const open = openStepId === step.id;
          const sessionRecord = step.kind === 'session' ? recordFor(step.id, null) : null;
          return (
            <div key={step.id} className="py-2">
              <button type="button" onClick={() => openStep(step)} aria-expanded={open}
                className="w-full flex items-center gap-3 text-left cursor-pointer">
                <div className="w-10 shrink-0 text-center">
                  <div className="text-xs uppercase text-stone-500">Day</div>
                  <div className="text-sm font-bold text-stone-800">{step.offset_day}</div>
                </div>
                <Icon className="w-4 h-4 text-stone-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-stone-900 truncate">{step.title}</div>
                  {sessionRecord?.scheduled_for && (
                    <div className="text-xs text-stone-500 truncate">
                      {formatSessionTime(sessionRecord.scheduled_for, timeZone)}
                      {sessionRecord.location ? ` · ${sessionRecord.location}` : ''}
                    </div>
                  )}
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${STATE_CLASS[progress.state]}`}>
                  {step.kind === 'personal' && progress.total ? `${progress.handled} of ${progress.total}` : STATE_LABEL[progress.state]}
                </span>
                {open ? <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-stone-500 shrink-0" />}
              </button>

              {open && step.kind === 'reminder' && (
                <div className="mt-2 ml-[3.25rem] p-3 rounded-xl bg-stone-50 text-xs text-stone-600 space-y-1">
                  <div className="font-medium">"{step.title}"</div>
                  {step.description && <div>{step.description}</div>}
                  <div className="text-stone-500">
                    Students see this in the app on days {step.offset_day} to {step.offset_day + REMINDER_VISIBLE_DAYS - 1}.
                  </div>
                </div>
              )}

              {open && step.kind === 'session' && (
                <div className="mt-2 ml-[3.25rem] space-y-2">
                  {step.description && <p className="text-xs text-stone-500">{step.description}</p>}
                  <label className="block text-xs text-stone-500">
                    When ({timeZone} time)
                    <input type="datetime-local" className={inputClass} value={draft.when}
                      onChange={(e) => setDraft((d) => ({ ...d, when: e.target.value }))} />
                  </label>
                  <label className="block text-xs text-stone-500">
                    Where (place or online link)
                    <input className={inputClass} value={draft.location}
                      onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} />
                  </label>
                  <label className="block text-xs text-stone-500">
                    Notes (only teachers and admins see these)
                    <textarea rows={2} className={inputClass} value={draft.notes}
                      onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
                  </label>
                  {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={saving || !draft.when} onClick={() => save(step, null, 'scheduled')}
                      className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer">
                      Save as scheduled
                    </button>
                    <button type="button" disabled={saving} onClick={() => save(step, null, 'done')}
                      className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer">
                      Mark as held
                    </button>
                    <button type="button" disabled={saving} onClick={() => save(step, null, 'skipped')}
                      className="px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-600 disabled:opacity-50 cursor-pointer">
                      Skip
                    </button>
                    {sessionRecord && (
                      <button type="button" disabled={saving} onClick={() => clear(sessionRecord)}
                        className="px-3 py-2 rounded-xl text-xs text-red-600 disabled:opacity-50 cursor-pointer">
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {open && step.kind === 'personal' && (
                <div className="mt-2 ml-[3.25rem] space-y-1">
                  {step.description && <p className="text-xs text-stone-500 pb-1">{step.description}</p>}
                  {enrolments.length === 0 && <p className="text-xs text-stone-500 italic">No students in this batch yet.</p>}
                  {/* Students still to follow up first */}
                  {[...enrolments]
                    .sort((a, b) => Number(!!recordFor(step.id, a.student_id)) - Number(!!recordFor(step.id, b.student_id)))
                    .map((enr) => {
                    const r = recordFor(step.id, enr.student_id);
                    const studentOpen = openStudentId === enr.student_id;
                    const name = enr.student?.full_name || enr.student?.email || 'Student';
                    return (
                      <div key={enr.student_id} className="rounded-xl border border-stone-100">
                        <div className="flex items-center gap-2 p-2">
                          <button type="button" disabled={saving} onClick={() => quickToggle(step, enr.student_id)}
                            aria-label={r ? `Clear follow-up for ${name}` : `Mark follow-up done for ${name}`}
                            className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50 ${
                              r?.status === 'done'
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : r?.status === 'skipped'
                                ? 'bg-stone-200 border-stone-300 text-stone-500'
                                : 'border-stone-300 text-transparent'
                            }`}>
                            {r?.status === 'skipped' ? <CircleSlash className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button type="button" onClick={() => openStudent(step, enr.student_id)} className="flex-1 min-w-0 text-left cursor-pointer">
                            <div className="text-sm text-stone-800 truncate">{name}</div>
                            {r?.notes && <div className="text-xs text-stone-500 truncate">{r.notes}</div>}
                          </button>
                        </div>
                        {studentOpen && (
                          <div className="px-2 pb-2 space-y-2">
                            <textarea rows={2} className={inputClass} placeholder="Notes (only teachers and admins see these)"
                              value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
                            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                            <div className="flex gap-2">
                              <button type="button" disabled={saving} onClick={() => save(step, enr.student_id, 'done')}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer">
                                Done
                              </button>
                              <button type="button" disabled={saving} onClick={() => save(step, enr.student_id, 'skipped')}
                                className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs text-stone-600 disabled:opacity-50 cursor-pointer">
                                Skip
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
