import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { deleteLesson, deleteModule, fetchProgrammeModules, saveLesson, saveModule } from '../lib/lmsService';
import {
  UNLOCK_RULE_LABEL,
  validateLessonInput,
  validateModuleInput,
  type LessonInput,
  type ModuleInput,
} from '../lib/lmsUtils';
import { renderMarkdown } from '../lib/markdown';
import type { Course, Lesson, LessonModule, ModuleUnlockRule } from '../types/database';
import { ArrowLeft, BookOpen, Clock, EyeOff, Pencil, PlusCircle, Trash2, Video } from 'lucide-react';

interface ModulesEditorProps {
  course: Course;
  onBack: () => void;
}

type Editing =
  | { kind: 'module'; input: ModuleInput }
  | { kind: 'lesson'; moduleId: string; input: LessonInput };

const inputClass =
  'w-full px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-500';
const labelClass = 'block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1';

/**
 * Staff editor for a programme's learning modules and lessons (SPEC "LMS").
 * Admins and teachers can add, edit, reorder (display order), hide and delete.
 */
export const ModulesEditor: React.FC<ModulesEditorProps> = ({ course, onBack }) => {
  const { organisation, user } = useAuth();
  const [modules, setModules] = useState<LessonModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setModules(await fetchProgrammeModules(course.id));
    } catch (err) {
      setMessage(`Could not load modules: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [course.id]);

  const nextOrder = (items: { sort_order?: number }[]) =>
    items.reduce((max, i) => Math.max(max, i.sort_order ?? 0), 0) + 10;

  const newModule = () => {
    setFormErrors([]);
    setEditing({
      kind: 'module',
      input: { title: '', description: '', sort_order: nextOrder(modules), unlock_rule: 'always', unlock_day: null, published: true },
    });
  };

  const editModule = (m: LessonModule) => {
    setFormErrors([]);
    setEditing({
      kind: 'module',
      input: {
        id: m.id,
        title: m.title,
        description: m.description || '',
        sort_order: m.sort_order,
        unlock_rule: m.unlock_rule,
        unlock_day: m.unlock_day,
        published: m.published,
      },
    });
  };

  const newLesson = (m: LessonModule) => {
    setFormErrors([]);
    setPreview(false);
    setEditing({
      kind: 'lesson',
      moduleId: m.id,
      input: { title: '', body: '', video_url: '', estimated_minutes: null, sort_order: nextOrder(m.lessons || []), published: true },
    });
  };

  const editLesson = (m: LessonModule, l: Lesson) => {
    setFormErrors([]);
    setPreview(false);
    setEditing({
      kind: 'lesson',
      moduleId: m.id,
      input: {
        id: l.id,
        title: l.title,
        body: l.body || '',
        video_url: l.video_url || '',
        estimated_minutes: l.estimated_minutes ?? null,
        sort_order: l.sort_order ?? 100,
        published: l.published,
      },
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !user) return;
    const errors = editing.kind === 'module' ? validateModuleInput(editing.input) : validateLessonInput(editing.input);
    setFormErrors(errors);
    if (errors.length) return;

    setSaving(true);
    const res =
      editing.kind === 'module'
        ? await saveModule(organisation.id, course.id, user.id, editing.input)
        : await saveLesson(organisation.id, course.id, editing.moduleId, user.id, editing.input);
    setSaving(false);
    if (!res.success) {
      setFormErrors([res.error || 'Could not save.']);
      return;
    }
    setEditing(null);
    await load();
  };

  const handleDeleteModule = async (m: LessonModule) => {
    const count = (m.lessons || []).length;
    if (!window.confirm(`Delete the module "${m.title}" and its ${count} lesson(s)? Students' progress on them is deleted too.`)) return;
    const res = await deleteModule(m.id);
    setMessage(res.success ? `Deleted "${m.title}".` : `Could not delete: ${res.error}`);
    await load();
  };

  const handleDeleteLesson = async (l: Lesson) => {
    if (!window.confirm(`Delete the lesson "${l.title}"? Students' progress on it is deleted too.`)) return;
    const res = await deleteLesson(l.id);
    setMessage(res.success ? `Deleted "${l.title}".` : `Could not delete: ${res.error}`);
    await load();
  };

  const updateModule = (patch: Partial<ModuleInput>) =>
    setEditing((prev) => (prev?.kind === 'module' ? { ...prev, input: { ...prev.input, ...patch } } : prev));
  const updateLesson = (patch: Partial<LessonInput>) =>
    setEditing((prev) => (prev?.kind === 'lesson' ? { ...prev, input: { ...prev.input, ...patch } } : prev));

  const ruleSummary = (m: LessonModule) =>
    m.unlock_rule === 'day' ? `Opens on day ${m.unlock_day}` : UNLOCK_RULE_LABEL[m.unlock_rule];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Programmes</span>
      </button>

      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <BookOpen className="w-4 h-4" />
          <span>Learning modules</span>
        </div>
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">{course.name}</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Students of this programme see these modules in order. A module can open from the start, on a day of the
          student's batch, or after the previous module is finished.
        </p>
        <button
          type="button"
          onClick={newModule}
          className="w-full mt-2 py-3 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New module</span>
        </button>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs text-stone-700 dark:text-stone-300">{message}</div>
      )}

      {!loading && modules.length === 0 && (
        <p className="text-xs text-stone-400 italic text-center">No modules yet. Add the first one above.</p>
      )}

      {modules.map((m) => (
        <div
          key={m.id}
          className={`bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm ${m.published ? '' : 'opacity-70'}`}
        >
          <div className="p-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">{m.title}</span>
                {!m.published && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                    <EyeOff className="w-3 h-3" /> Hidden
                  </span>
                )}
              </div>
              <div className="text-[11px] text-stone-500">{ruleSummary(m)} · order {m.sort_order}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => editModule(m)} aria-label={`Edit module ${m.title}`}
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer">
                <Pencil className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => handleDeleteModule(m)} aria-label={`Delete module ${m.title}`}
                className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="border-t border-stone-100 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800">
            {(m.lessons || []).map((l) => (
              <div key={l.id} className={`px-4 py-2.5 flex items-center gap-2 ${l.published ? '' : 'opacity-60'}`}>
                <span className="flex-1 min-w-0 text-sm text-stone-800 dark:text-stone-200 truncate">{l.title}</span>
                {!l.published && <EyeOff className="w-3.5 h-3.5 text-stone-400" />}
                {l.video_url && <Video className="w-3.5 h-3.5 text-stone-400" />}
                {l.estimated_minutes ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-stone-400">
                    <Clock className="w-3 h-3" />
                    {l.estimated_minutes}
                  </span>
                ) : null}
                <button type="button" onClick={() => editLesson(m, l)} aria-label={`Edit lesson ${l.title}`}
                  className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => handleDeleteLesson(l)} aria-label={`Delete lesson ${l.title}`}
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => newLesson(m)}
              className="w-full px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 hover:bg-stone-50 dark:hover:bg-stone-800/60 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add lesson</span>
            </button>
          </div>
        </div>
      ))}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/70 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4"
          >
            {editing.kind === 'module' ? (
              <>
                <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                  {editing.input.id ? 'Edit module' : 'New module'}
                </h2>
                <div>
                  <label className={labelClass} htmlFor="mod-title">Title</label>
                  <input id="mod-title" className={inputClass} value={editing.input.title}
                    onChange={(e) => updateModule({ title: e.target.value })} placeholder="e.g. Week 1 of your practice" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="mod-desc">Description</label>
                  <textarea id="mod-desc" rows={2} className={inputClass} value={editing.input.description}
                    onChange={(e) => updateModule({ description: e.target.value })} />
                </div>
                <div>
                  <span className={labelClass}>When does it open?</span>
                  <div className="space-y-1.5">
                    {(Object.keys(UNLOCK_RULE_LABEL) as ModuleUnlockRule[]).map((rule) => (
                      <label key={rule} className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300 cursor-pointer">
                        <input type="radio" name="unlock-rule" className="accent-emerald-600" checked={editing.input.unlock_rule === rule}
                          onChange={() => updateModule({ unlock_rule: rule, unlock_day: rule === 'day' ? editing.input.unlock_day ?? 1 : null })} />
                        <span>{UNLOCK_RULE_LABEL[rule]}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {editing.input.unlock_rule === 'day' && (
                  <div>
                    <label className={labelClass} htmlFor="mod-day">Opens on day</label>
                    <input id="mod-day" type="number" min={1} className={inputClass} value={editing.input.unlock_day ?? ''}
                      onChange={(e) => updateModule({ unlock_day: e.target.value === '' ? null : Number(e.target.value) })} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className={labelClass} htmlFor="mod-order">Display order</label>
                    <input id="mod-order" type="number" className={inputClass} value={editing.input.sort_order}
                      onChange={(e) => updateModule({ sort_order: Number(e.target.value) })} />
                  </div>
                  <label className="flex items-center gap-2 pb-2.5 text-sm text-stone-700 dark:text-stone-300 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={editing.input.published}
                      onChange={(e) => updateModule({ published: e.target.checked })} />
                    <span>Visible to students</span>
                  </label>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                  {editing.input.id ? 'Edit lesson' : 'New lesson'}
                </h2>
                <div>
                  <label className={labelClass} htmlFor="les-title">Title</label>
                  <input id="les-title" className={inputClass} value={editing.input.title}
                    onChange={(e) => updateLesson({ title: e.target.value })} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-stone-600 dark:text-stone-300" htmlFor="les-body">Text</label>
                    <button type="button" onClick={() => setPreview((p) => !p)}
                      className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer">
                      {preview ? 'Edit text' : 'Preview'}
                    </button>
                  </div>
                  {preview ? (
                    <div className="min-h-[10rem] p-3 rounded-xl border border-stone-200 dark:border-stone-700 text-sm text-stone-700 dark:text-stone-300 space-y-3">
                      {renderMarkdown(editing.input.body)}
                    </div>
                  ) : (
                    <textarea id="les-body" rows={8} className={`${inputClass} font-mono text-xs`} value={editing.input.body}
                      onChange={(e) => updateLesson({ body: e.target.value })}
                      placeholder={'## Heading\n\nA paragraph with **bold** and *italic*.\n\n- A bullet point\n1. A numbered step'} />
                  )}
                  <p className="text-[10px] text-stone-400 mt-1">Formatting: ## heading, **bold**, *italic*, - bullets, 1. numbered steps, [link](https://...)</p>
                </div>
                <div>
                  <label className={labelClass} htmlFor="les-video">Video link (optional)</label>
                  <input id="les-video" type="url" className={inputClass} value={editing.input.video_url}
                    onChange={(e) => updateLesson({ video_url: e.target.value })} placeholder="https://..." />
                </div>
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div>
                    <label className={labelClass} htmlFor="les-min">Minutes</label>
                    <input id="les-min" type="number" min={1} className={inputClass} value={editing.input.estimated_minutes ?? ''}
                      onChange={(e) => updateLesson({ estimated_minutes: e.target.value === '' ? null : Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="les-order">Order</label>
                    <input id="les-order" type="number" className={inputClass} value={editing.input.sort_order}
                      onChange={(e) => updateLesson({ sort_order: Number(e.target.value) })} />
                  </div>
                  <label className="flex items-center gap-2 pb-2.5 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={editing.input.published}
                      onChange={(e) => updateLesson({ published: e.target.checked })} />
                    <span>Visible</span>
                  </label>
                </div>
              </>
            )}

            {formErrors.length > 0 && (
              <ul className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                {formErrors.map((err) => <li key={err}>{err}</li>)}
              </ul>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)}
                className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold hover:opacity-90 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
