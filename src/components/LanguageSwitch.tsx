import React, { useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { LANGS, useI18n } from '../i18n';
import { Sheet } from './Sheet';

/** Three big buttons, each language written in its own script. */
export const LanguageChoices: React.FC<{ onPicked?: () => void }> = ({ onPicked }) => {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="radiogroup" aria-label={t('lang.choose')} className="grid grid-cols-3 gap-2">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={lang === l.code}
          lang={l.code}
          onClick={() => {
            setLang(l.code);
            onPicked?.();
          }}
          className={`min-h-12 px-2 rounded-2xl text-base font-semibold cursor-pointer ring-1 transition-colors inline-flex items-center justify-center gap-1.5 ${
            lang === l.code ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-800 ring-stone-300 hover:bg-stone-50'
          }`}
        >
          {/* The tick shows the chosen language without relying on colour */}
          {lang === l.code && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
          {l.name}
        </button>
      ))}
    </div>
  );
};

/** A small button for the top bar that opens the language choices. */
export const LanguageButton: React.FC<{ className?: string; withLabel?: boolean }> = ({ className = '', withLabel = false }) => {
  const { lang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.code === lang);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={withLabel ? `inline-flex items-center gap-2 cursor-pointer ${className}` : `ui-icon-btn ${className}`}
        aria-label={`${t('lang.choose')}: ${current?.name}`}
        title={t('lang.choose')}
      >
        <Languages className="w-5 h-5" />
        {withLabel && <span>{current?.name}</span>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('lang.choose')} size="sm">
        <LanguageChoices onPicked={() => setOpen(false)} />
      </Sheet>
    </>
  );
};
