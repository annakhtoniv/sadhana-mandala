// The line each reminder adds under the organisation's own text (Phase 21):
// where the person is in their week, so they keep it unbroken. English, like
// the reminder text the admin types. No imports: also used by the app's tests.

export interface WeekInfo {
  practice_day?: number | null;
  duration_days?: number | null;
  week_number?: number | null;
  week_done?: number | null;
  week_open_days?: number | null;
  week_unbroken?: boolean | null;
  today_morning?: boolean | null;
  today_evening?: boolean | null;
}

export function motivationLine(slot: 'morning' | 'evening', p: WeekInfo): string | null {
  const day = p.practice_day ?? 0;
  const total = p.duration_days ?? 0;
  const week = p.week_number ?? 0;
  if (day < 1 || total < 1 || week < 1) return null;

  if (slot === 'morning' && p.today_morning) return `Morning already ticked ✓ A lovely start to day ${day}.`;
  if (slot === 'evening' && p.today_evening) return `Evening already ticked ✓ Well done today.`;

  const fullWeek = week * 7 <= total;
  const weekEnd = Math.min(week * 7, total);
  const lead = slot === 'evening' && p.today_morning ? `Morning done ✓ ` : '';
  let line: string;
  if (!p.week_unbroken) {
    line = `Day ${day}: every practice counts. Start a fresh streak today 🌱`;
  } else if (fullWeek && day === weekEnd) {
    line = `Last day of week ${week}: practise today to complete it without a break and earn your badge 🏅`;
  } else if (fullWeek) {
    line = `Day ${day} · ${p.week_done ?? 0} of 7 days this week. Keep week ${week} unbroken 🔥`;
  } else {
    const left = total - day + 1;
    line = `Day ${day} of ${total}: ${left === 1 ? 'the last day' : `${left} days left`} to complete your whole practice 🌟`;
  }
  return lead + line;
}
