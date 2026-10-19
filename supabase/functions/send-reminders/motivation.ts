// What each reminder says (Phases 21 and 22): the organisation's text in the
// person's language, and a line about where they are in their week so they
// keep it unbroken. No imports: also used by the app's tests.

export type Lang = 'en' | 'ar' | 'hi';

export interface WeekInfo {
  practice_day?: number | null;
  duration_days?: number | null;
  week_number?: number | null;
  week_done?: number | null;
  week_open_days?: number | null;
  week_unbroken?: boolean | null;
  today_morning?: boolean | null;
  today_evening?: boolean | null;
  lang?: string | null;
}

/** The organisation's reminder texts (Arabic and Hindi are optional). */
export interface ReminderTexts {
  reminder_morning_text?: string | null;
  reminder_evening_text?: string | null;
  reminder_morning_text_ar?: string | null;
  reminder_morning_text_hi?: string | null;
  reminder_evening_text_ar?: string | null;
  reminder_evening_text_hi?: string | null;
}

// The English texts an organisation starts with (phase18_reminders.sql), and their translations
const STOCK = {
  morning: {
    en: 'Good morning. Time for your morning practice.',
    ar: 'صباح الخير. حان وقت ممارستك الصباحية.',
    hi: 'सुप्रभात। आपके सुबह के अभ्यास का समय है।',
  },
  evening: {
    en: 'Time for your evening practice.',
    ar: 'حان وقت ممارستك المسائية.',
    hi: 'आपके शाम के अभ्यास का समय है।',
  },
};

export function langOf(value: string | null | undefined): Lang {
  return value === 'ar' || value === 'hi' ? value : 'en';
}

/**
 * The reminder text in the person's language: the admin's own text for that
 * language; else the stock translation while the English text is still the
 * stock one; else the admin's English text.
 */
export function reminderText(slot: 'morning' | 'evening', texts: ReminderTexts, lang: Lang, fallback: string): string {
  const english = (slot === 'morning' ? texts.reminder_morning_text : texts.reminder_evening_text) || fallback;
  if (lang === 'en') return english;
  const own = texts[`reminder_${slot}_text_${lang}` as keyof ReminderTexts];
  if (own && own.trim()) return own.trim();
  return english.trim() === STOCK[slot].en ? STOCK[slot][lang] : english;
}

/** Phase 22: the Evening reminder only goes to people with no tick today. */
export function skipReminder(slot: 'morning' | 'evening', p: WeekInfo): boolean {
  return slot === 'evening' && Boolean(p.today_morning || p.today_evening);
}

type Lines = {
  morningDone: (day: number) => string;
  eveningDone: () => string;
  morningLead: () => string;
  broken: (day: number) => string;
  lastDay: (week: number) => string;
  progress: (day: number, done: number, week: number) => string;
  finalDays: (day: number, total: number, left: number) => string;
};

const LINES: Record<Lang, Lines> = {
  en: {
    morningDone: (d) => `Morning already ticked ✓ A lovely start to day ${d}.`,
    eveningDone: () => `Evening already ticked ✓ Well done today.`,
    morningLead: () => `Morning done ✓ `,
    broken: (d) => `Day ${d}: every practice counts. Start a fresh streak today 🌱`,
    lastDay: (w) => `Last day of week ${w}: practise today to complete it without a break and earn your badge 🏅`,
    progress: (d, n, w) => `Day ${d} · ${n} of 7 days this week. Keep week ${w} unbroken 🔥`,
    finalDays: (d, t, l) => `Day ${d} of ${t}: ${l === 1 ? 'the last day' : `${l} days left`} to complete your whole practice 🌟`,
  },
  ar: {
    morningDone: (d) => `تم تسجيل الصباح ✓ بداية جميلة لليوم ${d}.`,
    eveningDone: () => `تم تسجيل المساء ✓ أحسنت اليوم.`,
    morningLead: () => `تم الصباح ✓ `,
    broken: (d) => `اليوم ${d}: كل ممارسة لها قيمة. ابدأ سلسلة جديدة اليوم 🌱`,
    lastDay: (w) => `آخر يوم في الأسبوع ${w}: مارس اليوم لتكمله دون انقطاع وتحصل على شارتك 🏅`,
    progress: (d, n, w) => `اليوم ${d} · ${n} من 7 أيام هذا الأسبوع. حافظ على الأسبوع ${w} دون انقطاع 🔥`,
    finalDays: (d, t, l) => `اليوم ${d} من ${t}: ${l === 1 ? 'اليوم الأخير' : `بقي ${l} أيام`} لإكمال ممارستك كاملة 🌟`,
  },
  hi: {
    morningDone: (d) => `सुबह का टिक हो गया ✓ दिन ${d} की सुंदर शुरुआत।`,
    eveningDone: () => `शाम का टिक हो गया ✓ आज बहुत अच्छा किया।`,
    morningLead: () => `सुबह पूरी ✓ `,
    broken: (d) => `दिन ${d}: हर अभ्यास मायने रखता है। आज नई शृंखला शुरू करें 🌱`,
    lastDay: (w) => `सप्ताह ${w} का आख़िरी दिन: आज अभ्यास करें, सप्ताह बिना रुके पूरा करें और बैज पाएँ 🏅`,
    progress: (d, n, w) => `दिन ${d} · इस सप्ताह 7 में से ${n} दिन। सप्ताह ${w} बिना रुके जारी रखें 🔥`,
    finalDays: (d, t, l) => `दिन ${d} / ${t}: पूरा अभ्यास पूरा करने के लिए ${l === 1 ? 'आख़िरी दिन' : `${l} दिन बाकी`} 🌟`,
  },
};

export function motivationLine(slot: 'morning' | 'evening', p: WeekInfo): string | null {
  const day = p.practice_day ?? 0;
  const total = p.duration_days ?? 0;
  const week = p.week_number ?? 0;
  if (day < 1 || total < 1 || week < 1) return null;
  const L = LINES[langOf(p.lang)];

  if (slot === 'morning' && p.today_morning) return L.morningDone(day);
  if (slot === 'evening' && p.today_evening) return L.eveningDone();

  const fullWeek = week * 7 <= total;
  const weekEnd = Math.min(week * 7, total);
  const lead = slot === 'evening' && p.today_morning ? L.morningLead() : '';
  let line: string;
  if (!p.week_unbroken) line = L.broken(day);
  else if (fullWeek && day === weekEnd) line = L.lastDay(week);
  else if (fullWeek) line = L.progress(day, p.week_done ?? 0, week);
  else line = L.finalDays(day, total, total - day + 1);
  return lead + line;
}
