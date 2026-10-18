-- ============================================================================
-- Sadhana Mandala: Phase 18 migration (daily practice reminders)
--
-- PM request 2026-10-18: a push notification every day, Morning and Evening,
-- to everyone in a running batch with a daily practice (also to those who
-- already ticked). The admin sets the two times and texts.
--
--  1. Reminder settings on the organisation (on/off, two times, two texts).
--  2. push_subscriptions: the phones that turned reminders on. A person adds
--     or removes only their own phone, through two functions.
--  3. reminder_sends: one row per organisation, Morning or Evening, and day,
--     so a reminder goes out once even when the sender runs every few minutes.
--  4. Two functions only the sender (service role) may call: which reminders
--     are due now, and which phones get them.
--
-- The sender itself is the Edge Function supabase/functions/send-reminders,
-- started every 5 minutes by supabase/phase18_schedule.sql.
-- Safe to run more than once. Run after supabase/phase15_performance.sql,
-- then verify.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Settings (organisations can already be read by everyone and changed by
--    its admins, so no new rules are needed)
-- ----------------------------------------------------------------------------
alter table public.organisations
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists reminder_morning_time time not null default '06:00',
  add column if not exists reminder_morning_text text not null default 'Good morning. Time for your morning practice.',
  add column if not exists reminder_evening_time time not null default '19:00',
  add column if not exists reminder_evening_text text not null default 'Time for your evening practice.';

alter table public.organisations drop constraint if exists organisations_reminder_text_check;
alter table public.organisations add constraint organisations_reminder_text_check check (
  char_length(btrim(reminder_morning_text)) between 1 and 200
  and char_length(btrim(reminder_evening_text)) between 1 and 200
);

-- ----------------------------------------------------------------------------
-- 2. Phones with reminders on
-- ----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Only the browsers' own push services: the sender never posts anywhere else
  constraint push_subscriptions_endpoint_check check (
    endpoint ~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
    and char_length(endpoint) <= 1000
  ),
  constraint push_subscriptions_keys_check check (char_length(p256dh) <= 200 and char_length(auth) <= 100)
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index if not exists push_subscriptions_org_idx on public.push_subscriptions (org_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
revoke insert, update, truncate on public.push_subscriptions from authenticated;
drop policy if exists "push_subscriptions_own_read" on public.push_subscriptions;
create policy "push_subscriptions_own_read" on public.push_subscriptions
  as permissive for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "push_subscriptions_own_delete" on public.push_subscriptions;
create policy "push_subscriptions_own_delete" on public.push_subscriptions
  as permissive for delete to authenticated
  using (user_id = (select auth.uid()));

-- Turn reminders on for this phone. A phone that someone else used before
-- (they signed out, this person signed in) now belongs to this person.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.get_current_user_org_id();
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Sign in first';
  end if;
  if (select count(*) from public.push_subscriptions where user_id = auth.uid()) >= 10
     and not exists (select 1 from public.push_subscriptions where endpoint = p_endpoint) then
    raise exception 'Too many phones with reminders on';
  end if;
  insert into public.push_subscriptions (org_id, user_id, endpoint, p256dh, auth)
  values (v_org, auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set org_id = excluded.org_id, user_id = excluded.user_id,
        p256dh = excluded.p256dh, auth = excluded.auth, updated_at = now();
end;
$$;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- Turn reminders off for this phone (also on sign-out)
create or replace function public.remove_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke execute on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.remove_push_subscription(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Reminders already sent (admins read them)
-- ----------------------------------------------------------------------------
create table if not exists public.reminder_sends (
  org_id uuid not null references public.organisations(id) on delete cascade,
  slot text not null check (slot in ('morning', 'evening')),
  local_date date not null,
  sent_at timestamptz not null default now(),
  phones integer,
  primary key (org_id, slot, local_date)
);
alter table public.reminder_sends enable row level security;
revoke all on public.reminder_sends from anon;
revoke insert, update, delete, truncate on public.reminder_sends from authenticated;
drop policy if exists "reminder_sends_admin_read" on public.reminder_sends;
create policy "reminder_sends_admin_read" on public.reminder_sends
  as permissive for select to authenticated
  using (org_id = (select public.get_current_user_org_id()) and (select public.is_org_admin()));

-- ----------------------------------------------------------------------------
-- 4. For the sender only
-- ----------------------------------------------------------------------------
-- The reminders due now, each claimed once. A reminder is due from its time
-- until 3 hours later (if the sender was down, a morning reminder never
-- arrives at lunchtime).
create or replace function public.claim_due_reminders()
returns table (org_id uuid, slot text, title text, body text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with now_local as (
    select o.id, o.app_name, o.reminder_morning_time, o.reminder_morning_text,
           o.reminder_evening_time, o.reminder_evening_text,
           (now() at time zone o.timezone)::date as d,
           (now() at time zone o.timezone)::time as t
    from public.organisations o
    where o.reminders_enabled
  ),
  due as (
    select n.id, 'morning'::text as s, n.app_name, n.reminder_morning_text as txt, n.d
    from now_local n
    where n.t >= n.reminder_morning_time and n.t - n.reminder_morning_time < interval '3 hours'
    union all
    select n.id, 'evening'::text, n.app_name, n.reminder_evening_text, n.d
    from now_local n
    where n.t >= n.reminder_evening_time and n.t - n.reminder_evening_time < interval '3 hours'
  ),
  claimed as (
    insert into public.reminder_sends as rs (org_id, slot, local_date)
    select due.id, due.s, due.d from due
    on conflict do nothing
    returning rs.org_id, rs.slot
  )
  select c.org_id, c.slot, due.app_name, due.txt
  from claimed c join due on due.id = c.org_id and due.s = c.slot;
end;
$$;

-- Phones of everyone in a running batch with a daily practice
create or replace function public.reminder_recipients(p_org uuid)
returns table (endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select distinct s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  join public.enrolments e on e.student_id = s.user_id and e.org_id = p_org
  join public.batches b on b.id = e.batch_id
  join public.courses c on c.id = b.course_id
  join public.organisations o on o.id = b.org_id
  where s.org_id = p_org
    and c.has_practice_track
    and (now() at time zone o.timezone)::date between b.start_date and b.start_date + (c.duration_days - 1);
$$;

-- After sending: how many phones it reached; phones that no longer exist are removed
create or replace function public.finish_reminder_send(p_org uuid, p_slot text, p_phones integer, p_gone text[])
returns void language sql security definer set search_path = public as $$
  update public.reminder_sends set phones = p_phones
  where org_id = p_org and slot = p_slot
    and local_date = (select (now() at time zone timezone)::date from public.organisations where id = p_org);
  delete from public.push_subscriptions where endpoint = any (coalesce(p_gone, '{}'));
$$;

revoke execute on function public.claim_due_reminders() from public, anon, authenticated;
revoke execute on function public.reminder_recipients(uuid) from public, anon, authenticated;
revoke execute on function public.finish_reminder_send(uuid, text, integer, text[]) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_due_reminders() to service_role;
    grant execute on function public.reminder_recipients(uuid) to service_role;
    grant execute on function public.finish_reminder_send(uuid, text, integer, text[]) to service_role;
  end if;
end $$;
