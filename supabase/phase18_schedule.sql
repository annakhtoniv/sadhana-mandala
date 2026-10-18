-- ============================================================================
-- Sadhana Mandala: Phase 18 schedule (live project only, not in GitHub checks)
--
-- Starts the reminder sender (Edge Function send-reminders) every 5 minutes.
-- Run once, after phase18_reminders.sql and after the Edge Function is
-- deployed. Uses the public anon key (the same one the website uses): the
-- sender only sends reminders that are due and not yet sent, so starting it
-- more often does nothing extra. Safe to run more than once.
-- To stop all reminders: Admin > Organisation settings > Daily reminders off,
-- or here: select cron.unschedule('send-practice-reminders');
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('send-practice-reminders')
where exists (select 1 from cron.job where jobname = 'send-practice-reminders');

select cron.schedule(
  'send-practice-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://pshapxojprvgmwhdivim.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzaGFweG9qcHJ2Z213aGRpdmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDc0MTYsImV4cCI6MjEwNjc4MzQxNn0.-GOesOz0tkg7ZOp_Xxr1cs6ZEnD7v-DOCXshBL_c9lA'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
