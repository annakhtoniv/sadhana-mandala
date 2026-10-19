-- ============================================================================
-- Sadhana Mandala: Phase 21 migration (weekly badges, photo frames, reminders
-- that cheer on the week)
--
-- PM request 2026-10-19:
--  1. Every completed week of the daily practice earns a badge; the person can
--     put it around their profile photo as a frame. A week = days 1-7, 8-14,
--     ... of the batch; it is complete when each of its 7 days has a tick
--     (Morning or Evening, also when filled in later: the streak's rule).
--     Ticking every day of the practice earns the "complete" badge.
--  2. The Morning and Evening reminders say where the person is in their week
--     ("4 of 7 days this week...").
--
-- Safe to run more than once. Run after phase20_batch_end_date.sql, then
-- verify.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The frame around the profile photo (null = none)
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_frame text;
alter table public.profiles drop constraint if exists profiles_avatar_frame_check;
alter table public.profiles add constraint profiles_avatar_frame_check
  check (avatar_frame is null or avatar_frame ~ '^(week[1-9][0-9]?|complete)$');

-- The badges a person has earned, over all their practices
create or replace function public.earned_badges(p_user uuid)
returns text[] language sql stable security definer set search_path = public as $$
  with ticks as (
    select e.batch_id, c.duration_days, k.day_number
    from public.enrolments e
    join public.batches b on b.id = e.batch_id
    join public.courses c on c.id = b.course_id and c.has_practice_track
    join public.checkins k on k.batch_id = e.batch_id and k.student_id = e.student_id
    where e.student_id = p_user and (k.morning or k.evening)
      and k.day_number between 1 and c.duration_days
  ),
  weeks as (
    select 'week' || ((day_number - 1) / 7 + 1) as badge
    from ticks
    where (day_number - 1) / 7 + 1 <= duration_days / 7
    group by batch_id, (day_number - 1) / 7 + 1
    having count(distinct day_number) = 7
  ),
  complete as (
    select 'complete' as badge
    from ticks
    group by batch_id, duration_days
    having count(distinct day_number) = duration_days
  )
  select coalesce(array_agg(distinct badge order by badge), '{}')
  from (select badge from weeks union select badge from complete) x;
$$;
revoke execute on function public.earned_badges(uuid) from public, anon, authenticated;

create or replace function public.my_earned_badges()
returns text[] language sql stable security definer set search_path = public as $$
  select public.earned_badges(auth.uid());
$$;
revoke execute on function public.my_earned_badges() from public, anon;
grant execute on function public.my_earned_badges() to authenticated;

-- Put an earned badge around one's own photo (null takes the frame off)
create or replace function public.set_my_avatar_frame(p_frame text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if p_frame is not null and not (p_frame = any (public.earned_badges(auth.uid()))) then
    raise exception 'This badge is not earned yet';
  end if;
  update public.profiles set avatar_frame = p_frame where id = auth.uid();
end;
$$;
revoke execute on function public.set_my_avatar_frame(text) from public, anon;
grant execute on function public.set_my_avatar_frame(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Reminder recipients with their week (the sender words each reminder)
--    One row per phone: the practice that started most recently.
-- ----------------------------------------------------------------------------
drop function if exists public.reminder_recipients(uuid);
create function public.reminder_recipients(p_org uuid)
returns table (
  endpoint text, p256dh text, auth text,
  practice_day integer, duration_days integer, week_number integer,
  week_done integer, week_open_days integer, week_unbroken boolean,
  today_morning boolean, today_evening boolean
)
language sql stable security definer set search_path = public as $$
  with running as (
    select distinct on (s.endpoint)
      s.endpoint, s.p256dh, s.auth, e.batch_id, e.student_id, c.duration_days,
      ((now() at time zone o.timezone)::date - b.start_date + 1)::integer as day
    from public.push_subscriptions s
    join public.enrolments e on e.student_id = s.user_id and e.org_id = p_org
    join public.batches b on b.id = e.batch_id
    join public.courses c on c.id = b.course_id
    join public.organisations o on o.id = b.org_id
    where s.org_id = p_org
      and c.has_practice_track
      and (now() at time zone o.timezone)::date between b.start_date and b.start_date + (c.duration_days - 1)
    order by s.endpoint, b.start_date desc
  )
  select r.endpoint, r.p256dh, r.auth, r.day, r.duration_days,
         (r.day - 1) / 7 + 1,
         (select count(*)::integer from public.checkins k
            where k.batch_id = r.batch_id and k.student_id = r.student_id and (k.morning or k.evening)
              and k.day_number between ((r.day - 1) / 7) * 7 + 1 and r.day),
         r.day - ((r.day - 1) / 7) * 7,
         not exists (
           select 1 from generate_series(((r.day - 1) / 7) * 7 + 1, r.day - 1) d
           where not exists (select 1 from public.checkins k
             where k.batch_id = r.batch_id and k.student_id = r.student_id and k.day_number = d and (k.morning or k.evening))),
         coalesce((select k.morning from public.checkins k where k.batch_id = r.batch_id and k.student_id = r.student_id and k.day_number = r.day), false),
         coalesce((select k.evening from public.checkins k where k.batch_id = r.batch_id and k.student_id = r.student_id and k.day_number = r.day), false)
  from running r;
$$;
revoke execute on function public.reminder_recipients(uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.reminder_recipients(uuid) to service_role;
  end if;
end $$;
