import React, { useEffect, useMemo, useState } from 'react';
import { Sheet } from './Sheet';
import { hasRole } from '../lib/roles';
import { useAuth } from '../context/AuthContext';
import { fetchProgrammes, saveProgramme } from '../lib/programmeService';
import {
  hasPracticeTrack,
  practiceTrackName,
  validateProgrammeInput,
  type ProgrammeInput,
} from '../lib/programmeUtils';
import type { Course } from '../types/database';
import { ArrowLeft, BookOpen, CalendarClock, Flame, FolderOpen, Layers, Pencil, PlusCircle, RefreshCw } from 'lucide-react';
import { FollowupPlanEditor } from './FollowupPlanEditor';
import { ModulesEditor } from './ModulesEditor';
import { MaterialsEditor } from './MaterialsEditor';

interface ProgrammesManagerProps {
  onBack?: () => void;
}

const EMPTY_INPUT: ProgrammeInput = {
  name: '',
  code: '',
  category: '',
  description: '',
  programme_days: null,
  has_practice_track: false,
  practice_name: '',
  duration_days: 40,
  prerequisite_ids: [],
  is_active: true,
  sort_order: 100,
};

function toInput(course: Course): ProgrammeInput {
  return {
    id: course.id,
    name: course.name,
    code: course.code || '',
    category: course.category || '',
    description: course.description || '',
    programme_days: course.programme_days ?? null,
    has_practice_track: hasPracticeTrack(course),
    practice_name: course.practice_name || '',
    duration_days: course.duration_days || 40,
    prerequisite_ids: course.prerequisite_ids || [],
    is_active: course.is_active !== false,
    sort_order: course.sort_order ?? 100,
  };
}

/**
 * Programme catalogue (SPEC "Programmes"): admins and teachers add and edit
 * programmes here. Nothing about a programme is hard-coded in the app.
 */
export const ProgrammesManager: React.FC<ProgrammesManagerProps> = ({ onBack }) => {
  const { organisation, user, profile } = useAuth();
  // Admins change every programme; teachers the ones they added (database rule, Phase 14)
  const canEdit = (p: Course) => hasRole(profile, 'admin') || (Boolean(user) && p.created_by === user?.id);
  const [programmes, setProgrammes] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ProgrammeInput | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [modulesFor, setModulesFor] = useState<Course | null>(null);
  const [followupsFor, setFollowupsFor] = useState<Course | null>(null);
  const [materialsFor, setMaterialsFor] = useState<Course | null>(null);

  const loadData = async () => {
    if (!organisation.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      setProgrammes(await fetchProgrammes(organisation.id));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load programmes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation.id]);

  const nameById = useMemo(() => new Map(programmes.map((p) => [p.id, p.name])), [programmes]);

  const byCategory = useMemo(() => {
    const groups = new Map<string, Course[]>();
    for (const p of programmes) {
      const key = p.category || 'Programme';
      groups.set(key, [...(groups.get(key) || []), p]);
    }
    return Array.from(groups.entries());
  }, [programmes]);

  const categories = useMemo(
    () => Array.from(new Set(programmes.map((p) => p.category).filter(Boolean))) as string[],
    [programmes]
  );

  const openNew = () => {
    setFormErrors([]);
    setEditing({ ...EMPTY_INPUT, sort_order: (programmes.length + 1) * 10 });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !user) return;

    const errors = validateProgrammeInput(editing, programmes);
    setFormErrors(errors);
    if (errors.length > 0) return;

    setSaving(true);
    const res = await saveProgramme(organisation.id, user.id, editing);
    setSaving(false);
    if (!res.success) {
      setFormErrors([res.error || 'Could not save the programme.']);
      return;
    }
    setEditing(null);
    await loadData();
  };

  const update = (patch: Partial<ProgrammeInput>) => setEditing((prev) => (prev ? { ...prev, ...patch } : prev));

  if (modulesFor) {
    return <ModulesEditor course={modulesFor} onBack={() => setModulesFor(null)} />;
  }
  if (followupsFor) {
    return <FollowupPlanEditor course={followupsFor} onBack={() => setFollowupsFor(null)} />;
  }
  if (materialsFor) {
    return <MaterialsEditor course={materialsFor} onBack={() => setMaterialsFor(null)} />;
  }

  const inputClass = 'ui-input';
  const labelClass = 'ui-label';

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="ui-btn-ghost !min-h-10 !py-2 !px-4"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          <span>Back</span>
        </button>
      )}

      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
            <BookOpen className="w-4 h-4" />
            <span>Programme catalogue</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1 text-stone-500 hover:text-stone-700"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <h1 className="text-xl font-semibold text-stone-900">Programmes ({programmes.length})</h1>
        <p className="text-xs text-stone-500">
          Add and edit the programmes your students can join. A daily practice track adds the daily check-in,
          streak and trail for that programme only.
        </p>
        <button
          type="button"
          onClick={openNew}
          className="w-full mt-2 py-3 rounded-xl bg-stone-900 text-stone-100 text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New programme</span>
        </button>
      </div>

      {loadError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          Could not load programmes: {loadError}
        </div>
      )}

      {!loading && !loadError && programmes.length === 0 && (
        <p className="text-xs text-stone-500 italic text-center">No programmes yet. Add the first one above.</p>
      )}

      {byCategory.map(([category, items]) => (
        <div key={category} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            {category}
          </h2>
          {items.map((p) => (
            <div
              key={p.id}
              className={`bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-2 ${
                p.is_active === false ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-stone-900">{p.name}</span>
                    {p.code && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-stone-100 text-stone-600">
                        {p.code}
                      </span>
                    )}
                    {p.is_active === false && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-200 text-stone-600">
                        Inactive
                      </span>
                    )}
                  </div>
                  {p.programme_days ? (
                    <div className="text-xs text-stone-500">{p.programme_days}-day programme</div>
                  ) : null}
                </div>
                {canEdit(p) && (
                <button
                  type="button"
                  onClick={() => {
                    setFormErrors([]);
                    setEditing(toInput(p));
                  }}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 text-xs text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>
                )}
              </div>

              {p.description && <p className="text-xs text-stone-500">{p.description}</p>}

              <div className="flex flex-wrap gap-1.5 text-xs">
                {hasPracticeTrack(p) ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <Flame className="w-3 h-3" />
                    {practiceTrackName(p)} · {p.duration_days} days
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
                    No daily practice track
                  </span>
                )}
                {(p.prerequisite_ids || []).length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                    After: {(p.prerequisite_ids || []).map((id) => nameById.get(id) || 'removed programme').join(', ')}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setMaterialsFor(p)}
                  className="py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Materials</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModulesFor(p)}
                  className="py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Modules</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFollowupsFor(p)}
                  className="py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>Follow-ups</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {editing && (
        <Sheet open onClose={() => setEditing(null)} title={editing.id ? 'Edit programme' : 'New programme'} busy={saving}>
          <form onSubmit={handleSave} className="space-y-4">

            <div>
              <label className={labelClass} htmlFor="prog-name">Name</label>
              <input id="prog-name" className={inputClass} value={editing.name}
                onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Art of Silence" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="prog-code">Short code</label>
                <input id="prog-code" className={inputClass} value={editing.code}
                  onChange={(e) => update({ code: e.target.value.toUpperCase() })} placeholder="e.g. AOS" />
              </div>
              <div>
                <label className={labelClass} htmlFor="prog-days">Programme length (days)</label>
                <input id="prog-days" type="number" min={1} className={inputClass}
                  value={editing.programme_days ?? ''}
                  onChange={(e) => update({ programme_days: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="optional" />
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="prog-category">Category</label>
              <input id="prog-category" list="prog-categories" className={inputClass} value={editing.category}
                onChange={(e) => update({ category: e.target.value })} placeholder="e.g. Advanced programme" />
              <datalist id="prog-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div>
              <label className={labelClass} htmlFor="prog-desc">Description</label>
              <textarea id="prog-desc" rows={3} className={inputClass} value={editing.description}
                onChange={(e) => update({ description: e.target.value })} />
            </div>

            <div className="p-3 rounded-2xl border border-stone-200 space-y-3">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span>
                  <span className="block text-sm font-medium text-stone-900">Daily practice track</span>
                  <span className="block text-xs text-stone-500">Daily check-in, streak, trail and Quiet alerts</span>
                </span>
                <input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={editing.has_practice_track}
                  onChange={(e) => update({ has_practice_track: e.target.checked })} />
              </label>
              {editing.has_practice_track && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="prog-practice-name">Practice name</label>
                    <input id="prog-practice-name" className={inputClass} value={editing.practice_name}
                      onChange={(e) => update({ practice_name: e.target.value })} placeholder="e.g. 40-Day Sadhana" />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="prog-practice-days">Practice days</label>
                    <input id="prog-practice-days" type="number" min={1} max={365} className={inputClass}
                      value={editing.duration_days}
                      onChange={(e) => update({ duration_days: Number(e.target.value) })} />
                  </div>
                </div>
              )}
            </div>

            {programmes.filter((p) => p.id !== editing.id).length > 0 && (
              <div>
                <span className={labelClass}>Recommended after (prerequisites)</span>
                <div className="flex flex-wrap gap-1.5">
                  {programmes.filter((p) => p.id !== editing.id).map((p) => {
                    const selected = editing.prerequisite_ids.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          update({
                            prerequisite_ids: selected
                              ? editing.prerequisite_ids.filter((id) => id !== p.id)
                              : [...editing.prerequisite_ids, p.id],
                          })
                        }
                        className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer ${
                          selected
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-stone-50 text-stone-600 border-stone-200'
                        }`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className={labelClass} htmlFor="prog-order">Display order</label>
                <input id="prog-order" type="number" className={inputClass} value={editing.sort_order}
                  onChange={(e) => update({ sort_order: Number(e.target.value) })} />
              </div>
              <label className="flex items-center gap-2 pb-2.5 text-sm text-stone-700 cursor-pointer">
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
                {saving ? 'Saving...' : 'Save programme'}
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  );
};
