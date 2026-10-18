import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sheet, useConfirm } from './Sheet';
import { deleteStep, fetchFollowupPlan, saveStep } from '../lib/followupService';
import { FOLLOWUP_KIND_LABEL, REMINDER_VISIBLE_DAYS, validateStepInput, type StepInput } from '../lib/followupUtils';
import type { Course, FollowupKind, FollowupStep } from '../types/database';
import { ArrowLeft, Bell, CalendarClock, EyeOff, Pencil, PhoneCall, PlusCircle, Trash2 } from 'lucide-react';

interface FollowupPlanEditorProps {
  course: Course;
  onBack: () => void;
}

export const KIND_ICON: Record<FollowupKind, React.FC<{ className?: string }>> = {
  session: CalendarClock,
  personal: PhoneCall,
  reminder: Bell,
};

const KIND_HELP: Record<FollowupKind, string> = {
  session: 'A group session. The teacher schedules it for each batch and marks it held.',
  personal: 'A personal follow-up with every student, e.g. a check-in call. The teacher ticks each student off, with private notes.',
  reminder: `A short message students see in the app from this day, for ${REMINDER_VISIBLE_DAYS} days.`,
};

const inputClass = 'ui-input';
const labelClass = 'ui-label';

/** Admins and teachers define a programme's follow-up plan (SPEC "Follow-ups"). */
export const FollowupPlanEditor: React.FC<FollowupPlanEditorProps> = ({ course, onBack }) => {
  const { organisation, user } = useAuth();
  const confirm = useConfirm();
  const [steps, setSteps] = useState<FollowupStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<StepInput | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setSteps(await fetchFollowupPlan(course.id));
    } catch (err) {
      setMessage(`Could not load the plan: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [course.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !user) return;
    const errors = validateStepInput(editing);
    setFormErrors(errors);
    if (errors.length) return;
    setSaving(true);
    const res = await saveStep(organisation.id, course.id, user.id, editing);
    setSaving(false);
    if (!res.success) {
      setFormErrors([res.error || 'Could not save.']);
      return;
    }
    setEditing(null);
    await load();
  };

  const handleDelete = async (s: FollowupStep) => {
    if (!(await confirm({ title: `Delete "${s.title}"?`, message: 'What was recorded for it in every batch is deleted too.', confirmLabel: 'Delete', danger: true }))) return;
    const res = await deleteStep(s.id);
    setMessage(res.success ? `Deleted "${s.title}".` : `Could not delete: ${res.error}`);
    await load();
  };

  const update = (patch: Partial<StepInput>) => setEditing((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      <button type="button" onClick={onBack}
        className="ui-btn-ghost !min-h-10 !py-2 !px-4">
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        <span>Back to Programmes</span>
      </button>

      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
          <CalendarClock className="w-4 h-4" />
          <span>Follow-up plan</span>
        </div>
        <h1 className="text-xl font-semibold text-stone-900">{course.name}</h1>
        <p className="text-xs text-stone-500">
          Each step falls due on a day of every batch of this programme (Day 1 is the batch start date).
        </p>
        <button type="button"
          onClick={() => {
            setFormErrors([]);
            setEditing({ kind: 'session', title: '', description: '', offset_day: 1, sort_order: 10, is_active: true });
          }}
          className="w-full mt-2 py-3 rounded-xl bg-stone-900 text-stone-100 text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer">
          <PlusCircle className="w-4 h-4" />
          <span>New step</span>
        </button>
      </div>

      {message && <div className="p-3 rounded-xl bg-stone-100 text-xs text-stone-700">{message}</div>}

      {!loading && steps.length === 0 && (
        <p className="text-xs text-stone-500 italic text-center">No follow-up steps yet. Add the first one above.</p>
      )}

      {steps.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm divide-y divide-stone-100">
          {steps.map((s) => {
            const Icon = KIND_ICON[s.kind];
            return (
              <div key={s.id} className={`p-4 flex items-start gap-3 ${s.is_active ? '' : 'opacity-60'}`}>
                <div className="w-12 shrink-0 text-center">
                  <div className="text-xs uppercase text-stone-500">Day</div>
                  <div className="text-lg font-bold text-stone-900">{s.offset_day}</div>
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    <Icon className="w-3 h-3" />
                    {FOLLOWUP_KIND_LABEL[s.kind]}
                    {!s.is_active && <EyeOff className="w-3 h-3 text-stone-500 ms-1" />}
                  </div>
                  <div className="text-sm font-medium text-stone-900">{s.title}</div>
                  {s.description && <div className="text-xs text-stone-500">{s.description}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" aria-label={`Edit ${s.title}`}
                    onClick={() => {
                      setFormErrors([]);
                      setEditing({ id: s.id, kind: s.kind, title: s.title, description: s.description || '', offset_day: s.offset_day, sort_order: s.sort_order, is_active: s.is_active });
                    }}
                    className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" aria-label={`Delete ${s.title}`} onClick={() => handleDelete(s)}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <Sheet open onClose={() => setEditing(null)} title={editing.id ? 'Edit step' : 'New step'} busy={saving}>
          <form onSubmit={handleSave} className="space-y-4">

            <div>
              <span className={labelClass}>Kind</span>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(FOLLOWUP_KIND_LABEL) as FollowupKind[]).map((k) => {
                  const Icon = KIND_ICON[k];
                  const selected = editing.kind === k;
                  return (
                    <button key={k} type="button" onClick={() => update({ kind: k })} aria-pressed={selected}
                      className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 cursor-pointer ${
                        selected ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-stone-50 text-stone-600 border-stone-200'
                      }`}>
                      <Icon className="w-4 h-4" />
                      {k === 'session' ? 'Session' : k === 'personal' ? 'Personal' : 'Reminder'}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-stone-500 mt-1.5">{KIND_HELP[editing.kind]}</p>
            </div>

            <div>
              <label className={labelClass} htmlFor="step-title">{editing.kind === 'reminder' ? 'Reminder text' : 'Title'}</label>
              <input id="step-title" className={inputClass} value={editing.title} onChange={(e) => update({ title: e.target.value })}
                placeholder={editing.kind === 'reminder' ? 'e.g. Halfway there!' : editing.kind === 'personal' ? 'e.g. Check-in call' : 'e.g. Week 1 follow-up session'} />
            </div>
            <div>
              <label className={labelClass} htmlFor="step-desc">Details (optional)</label>
              <textarea id="step-desc" rows={2} className={inputClass} value={editing.description} onChange={(e) => update({ description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <label className={labelClass} htmlFor="step-day">Day</label>
                <input id="step-day" type="number" min={1} max={365} className={inputClass} value={editing.offset_day}
                  onChange={(e) => update({ offset_day: Number(e.target.value) })} />
              </div>
              <div>
                <label className={labelClass} htmlFor="step-order">Order</label>
                <input id="step-order" type="number" className={inputClass} value={editing.sort_order}
                  onChange={(e) => update({ sort_order: Number(e.target.value) })} />
              </div>
              <label className="flex items-center gap-2 pb-2.5 text-xs text-stone-700 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={editing.is_active}
                  onChange={(e) => update({ is_active: e.target.checked })} />
                <span>Active</span>
              </label>
            </div>

            {formErrors.length > 0 && (
              <ul role="alert" className="p-3 rounded-xl bg-red-50 text-sm text-red-700 space-y-1 list-disc list-inside">
                {formErrors.map((err) => <li key={err}>{err}</li>)}
              </ul>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)}
                className="ui-btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="ui-btn-primary">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  );
};
