import React, { useEffect, useRef, useState } from 'react';
import { ALL_ROLES, ROLE_HINT, ROLE_LABEL } from '../lib/roles';
import type { UserRole } from '../types/database';
import { Check, ChevronDown, Loader2 } from 'lucide-react';

const ROLE_TONE: Record<UserRole, string> = {
  admin: 'bg-amber-50 text-amber-700 ring-amber-200',
  teacher: 'bg-sky-50 text-sky-700 ring-sky-200',
  volunteer: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  student: 'bg-stone-100 text-stone-600 ring-stone-200',
};

export const RoleChip: React.FC<{ role: UserRole }> = ({ role }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ring-1 ${ROLE_TONE[role]}`}>
    {ROLE_LABEL[role]}
  </span>
);

interface RolePickerProps {
  value: UserRole[];
  /** Called with the new list; may save and throw (the message is shown) */
  onChange: (roles: UserRole[]) => void | Promise<void>;
  /** Roles that cannot be removed here, with the reason shown next to them */
  locked?: Partial<Record<UserRole, string>>;
  label?: string;
  /** Open the list to the left edge instead of the right (for wide rows) */
  align?: 'left' | 'right';
}

/** Multi-select drop-down: a person can hold any mix of the four roles (at least one). */
export const RolePicker: React.FC<RolePickerProps> = ({ value, onChange, locked = {}, label = 'Roles', align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const selected = ALL_ROLES.filter((r) => value.includes(r));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = async (role: UserRole) => {
    setError(null);
    const has = selected.includes(role);
    if (has && locked[role]) return;
    if (has && selected.length === 1) {
      setError('A person needs at least one role.');
      return;
    }
    const next = has ? selected.filter((r) => r !== role) : ALL_ROLES.filter((r) => r === role || selected.includes(r));
    setSaving(role);
    try {
      await onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected.map((r) => ROLE_LABEL[r]).join(', ')}`}
        className="flex items-center gap-1 flex-wrap justify-end max-w-[11rem] sm:max-w-none rounded-xl px-1.5 py-1 hover:bg-stone-100 cursor-pointer"
      >
        {selected.map((r) => (
          <RoleChip key={r} role={r} />
        ))}
        <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className={`absolute z-30 mt-1 w-64 ui-glass !bg-white rounded-2xl p-1.5 shadow-xl ring-1 ring-stone-200 ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {ALL_ROLES.map((r) => {
            const on = selected.includes(r);
            const lock = on ? locked[r] : undefined;
            return (
              <button
                key={r}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(r)}
                disabled={saving !== null || Boolean(lock)}
                className="w-full flex items-start gap-2.5 p-2 rounded-xl text-left hover:bg-stone-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span
                  className={`mt-0.5 w-4 h-4 rounded-md flex items-center justify-center shrink-0 ring-1 ${
                    on ? 'bg-stone-900 ring-stone-900 text-white' : 'bg-white ring-stone-300'
                  } ${lock ? 'opacity-50' : ''}`}
                >
                  {saving === r ? <Loader2 className="w-3 h-3 animate-spin" /> : on && <Check className="w-3 h-3" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-stone-900">{ROLE_LABEL[r]}</span>
                  <span className="block text-[11px] text-stone-500">{lock || ROLE_HINT[r]}</span>
                </span>
              </button>
            );
          })}
          {error && <p role="alert" className="px-2 pb-1 text-[11px] text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
};
