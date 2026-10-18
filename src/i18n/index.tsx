import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en, type MsgKey } from './en';
import { ar } from './ar';
import { hi } from './hi';

import { currentLang, LANG_STORAGE_KEY, setCurrentLang, type Lang } from './locale';

export type { Lang, MsgKey };
export { currentLang, currentLocale } from './locale';

export const LANGS: Array<{ code: Lang; name: string; english: string }> = [
  { code: 'en', name: 'English', english: 'English' },
  { code: 'ar', name: 'العربية', english: 'Arabic' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi' },
];

const DICTS: Record<Lang, Record<MsgKey, string>> = { en, ar, hi };

export type Vars = Record<string, string | number>;

/** Translate a key; {name} placeholders are filled from vars. Falls back to English. */
export function translate(key: MsgKey, vars?: Vars, lang: Lang = currentLang()): string {
  let text = DICTS[lang][key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  }
  return text;
}

function applyToDocument(lang: Lang) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}
applyToDocument(currentLang());

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MsgKey, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue>({
  lang: currentLang(),
  setLang: () => {},
  t: (key, vars) => translate(key, vars),
});

/** English, Arabic (right to left) or Hindi. The choice is remembered on this device. */
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(currentLang());

  const setLang = useCallback((next: Lang) => {
    setCurrentLang(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // not remembered; still switches now
    }
    setLangState(next);
  }, []);

  useEffect(() => applyToDocument(lang), [lang]);

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t: (key, vars) => translate(key, vars, lang) }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
/** `const t = useT(); t('home.title')` */
export const useT = () => useContext(I18nContext).t;
