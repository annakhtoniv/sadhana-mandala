// Sends the Morning and Evening practice reminders (Phase 18) and teachers'
// encouragement (Phase 22).
// Started every 5 minutes by supabase/phase18_schedule.sql. Each reminder is
// claimed once in the database (claim_due_reminders), so running this more
// often, or by hand, never sends a reminder twice.
//
// Secrets (Supabase > Edge Functions > Secrets): VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY and VAPID_SUBJECT (mailto:...). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are set by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import webpush from 'npm:web-push@3.6.7';
import { langOf, motivationLine, reminderText, skipReminder, type ReminderTexts, type WeekInfo } from './motivation.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:support@zyxenai.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

interface Due { org_id: string; slot: 'morning' | 'evening'; title: string; body: string }
// Phase 21/22: each phone comes with its owner's week and language
interface Phone extends WeekInfo { endpoint: string; p256dh: string; auth: string }
interface Pending { id: string; org_id: string; app_name: string; message: string; teacher: string; endpoint: string | null; p256dh: string | null; auth: string | null }

/** Sends one notification; returns 'gone' when the phone no longer accepts them. */
async function push(p: { endpoint: string; p256dh: string; auth: string }, payload: string): Promise<'sent' | 'gone' | 'failed'> {
  try {
    await webpush.sendNotification(
      { endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } },
      payload,
      { TTL: 3 * 60 * 60, urgency: 'normal' },
    );
    return 'sent';
  } catch (e) {
    // 404 / 410: the person turned notifications off or removed the app
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? 'gone' : 'failed';
  }
}

Deno.serve(async () => {
  const { data: due, error } = await db.rpc('claim_due_reminders');
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const report: Array<{ org: string; slot: string; phones: number; sent: number; skipped: number }> = [];
  for (const r of (due || []) as Due[]) {
    const { data: phones, error: pErr } = await db.rpc('reminder_recipients', { p_org: r.org_id });
    if (pErr) {
      report.push({ org: r.org_id, slot: r.slot, phones: -1, sent: 0, skipped: 0 });
      continue;
    }
    // The texts in Arabic and Hindi (columns from phase22; missing before it ran)
    const { data: org } = await db.from('organisations').select('*').eq('id', r.org_id).maybeSingle();
    const texts = (org || {}) as ReminderTexts;
    const gone: string[] = [];
    let sent = 0;
    let skipped = 0;
    // A few at a time: fast enough for hundreds of phones, gentle on the push services
    const list = (phones || []) as Phone[];
    for (let i = 0; i < list.length; i += 20) {
      await Promise.all(list.slice(i, i + 20).map(async (p) => {
        // Phase 22: no Evening reminder for people who already practised today
        if (skipReminder(r.slot, p)) {
          skipped++;
          return;
        }
        const text = reminderText(r.slot, texts, langOf(p.lang), r.body);
        const line = motivationLine(r.slot, p);
        const payload = JSON.stringify({ title: r.title, body: line ? `${text}\n${line}` : text, tag: `practice-${r.slot}`, url: '/' });
        const result = await push(p, payload);
        if (result === 'sent') sent++;
        if (result === 'gone') gone.push(p.endpoint);
      }));
    }
    await db.rpc('finish_reminder_send', { p_org: r.org_id, p_slot: r.slot, p_phones: sent, p_gone: gone });
    report.push({ org: r.org_id, slot: r.slot, phones: list.length, sent, skipped });
  }

  // Phase 22: teachers' encouragement, to every phone of the student (none: shown in the app only)
  let encouraged = 0;
  const { data: pending } = await db.rpc('pending_encouragements');
  if (pending && (pending as Pending[]).length) {
    const rows = pending as Pending[];
    const done = new Set<string>();
    for (const n of rows) {
      done.add(n.id);
      if (!n.endpoint || !n.p256dh || !n.auth) continue;
      const body = n.teacher ? `${n.teacher}: ${n.message}` : n.message;
      const result = await push({ endpoint: n.endpoint, p256dh: n.p256dh, auth: n.auth }, JSON.stringify({ title: n.app_name, body, tag: `encourage-${n.id}`, url: '/' }));
      if (result === 'sent') encouraged++;
    }
    await db.rpc('finish_encouragements', { p_ids: [...done] });
  }

  return Response.json({ sent: report, encouraged });
});
