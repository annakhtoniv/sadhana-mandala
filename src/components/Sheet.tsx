import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useT } from '../i18n';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** A line under the title */
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Buttons at the bottom (stay visible while the content scrolls) */
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Set when closing must be blocked (e.g. while saving) */
  busy?: boolean;
  tone?: 'default' | 'danger';
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one pop-up used everywhere (Phase 16): a sheet from the bottom on a
 * phone, a centred window on a computer. Screen readers hear it as a dialog;
 * keyboard focus stays inside, Escape closes it and focus returns to where it was.
 */
export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, description, children, footer, size = 'md', busy = false, tone = 'default' }) => {
  const t = useT();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the first field (or the panel itself)
    const first = panel?.querySelector<HTMLElement>('input, select, textarea') || panel;
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault();
          firstItem.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [open, busy]);

  if (!open) return null;
  const width = size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-stone-950/50 backdrop-blur-[2px]" onClick={() => !busy && onClose()} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative w-full ${width} max-h-[92dvh] flex flex-col bg-white rounded-t-[1.75rem] sm:rounded-[1.75rem] shadow-2xl outline-none animate-fade-up pb-[env(safe-area-inset-bottom)]`}
      >
        <div className="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-stone-200" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
          <div className="min-w-0">
            <h2 id={titleId} className={`font-display text-lg font-semibold ${tone === 'danger' ? 'text-red-700' : 'text-stone-950'}`}>
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-sm text-stone-600 mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="ui-icon-btn -me-2 -mt-1 shrink-0" aria-label={t('common.close')}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 pb-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-stone-100 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Replaces window.confirm with a sheet that matches the app (and can be read aloud). */
export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const t = useT();
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback<ConfirmFn>((options) => new Promise<boolean>((resolve) => setState({ ...options, resolve })), []);
  const answer = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet
        open={state !== null}
        onClose={() => answer(false)}
        title={state?.title || ''}
        description={state?.message}
        size="sm"
        tone={state?.danger ? 'danger' : 'default'}
        footer={
          <>
            <button type="button" onClick={() => answer(false)} className="ui-btn-ghost">
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => answer(true)}
              className={state?.danger ? 'ui-btn bg-red-600 text-white hover:bg-red-700' : 'ui-btn-primary'}
            >
              {state?.confirmLabel || t('common.ok')}
            </button>
          </>
        }
      >
        {null}
      </Sheet>
    </ConfirmContext.Provider>
  );
};

/** `const confirm = useConfirm(); if (await confirm({ title: 'Delete?' })) ...` */
export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  // Outside the provider (tests): fall back to the browser box
  return fn || (async (o) => window.confirm(o.message ? `${o.title}\n\n${o.message}` : o.title));
}
