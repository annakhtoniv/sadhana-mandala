/** The current language, readable from plain code (dates, error messages) without React. */
export type Lang = 'en' | 'ar' | 'hi';

/** Locales for dates; Arabic keeps 0-9 digits, as is usual in the UAE */
const LOCALES: Record<Lang, string> = { en: 'en-GB', ar: 'ar-AE-u-nu-latn', hi: 'hi-IN' };
export const LANG_STORAGE_KEY = 'sadhana_lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'ar' || saved === 'hi') return saved;
  } catch {
    // storage blocked or not in a browser: fall through
  }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  if (nav.startsWith('ar')) return 'ar';
  if (nav.startsWith('hi')) return 'hi';
  return 'en';
}

let current: Lang = initialLang();
export const currentLang = (): Lang => current;
export const currentLocale = (): string => LOCALES[current];
export function setCurrentLang(lang: Lang) {
  current = lang;
}
