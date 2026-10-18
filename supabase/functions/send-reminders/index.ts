// Sends the Morning and Evening practice reminders (Phase 18).
// Started every 5 minutes by supabase/phase18_schedule.sql. Each reminder is
// claimed once in the database (claim_due_reminders), so running this more
// often, or by hand, never sends a reminder twice.
//
// Secrets (Supabase > Edge Functions > Secrets): VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY and VAPID_SUBJECT (mailto:...). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are set by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import webpush from 'npm:web-push@3.6.7';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:support@zyxenai.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

interface Due { org_id: string; slot: 'morning' | 'evening'; title: string; body: string }
interface Phone { endpoint: string; p256dh: string; auth: string }

Deno.serve(async () => {
  const { data: due, error } = await db.rpc('claim_due_reminders');
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const report: Array<{ org: string; slot: string; phones: number; sent: number }> = [];
  for (const r of (due || []) as Due[]) {
    const { data: phones, error: pErr } = await db.rpc('reminder_recipients', { p_org: r.org_id });
    if (pErr) {
      report.push({ org: r.org_id, slot: r.slot, phones: -1, sent: 0 });
      continue;
    }
    const payload = JSON.stringify({ title: r.title, body: r.body, tag: `practice-${r.slot}`, url: '/' });
    const gone: string[] = [];
    let sent = 0;
    // A few at a time: fast enough for hundreds of phones, gentle on the push services
    const list = (phones || []) as Phone[];
    for (let i = 0; i < list.length; i += 20) {
      await Promise.all(list.slice(i, i + 20).map(async (p) => {
        try {
          await webpush.sendNotification(
            { endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } },
            payload,
            { TTL: 3 * 60 * 60, urgency: 'normal' },
          );
          sent++;
        } catch (e) {
          // 404 / 410: the person turned notifications off or removed the app
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(p.endpoint);
        }
      }));
    }
    await db.rpc('finish_reminder_send', { p_org: r.org_id, p_slot: r.slot, p_phones: sent, p_gone: gone });
    report.push({ org: r.org_id, slot: r.slot, phones: list.length, sent });
  }
  return Response.json({ sent: report });
});
