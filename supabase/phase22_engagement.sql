-- ============================================================================
-- Sadhana Mandala: Phase 22 migration (practising together)
--
-- PM request 2026-10-19:
--  1. Reminders in each student's own language (English, Arabic, Hindi).
--  2. (app only) Share a badge to WhatsApp.
--  3. The Evening reminder only goes to people with no tick today.
--  4. Teachers send encouragement from the batch page (in the app and, when
--     reminders are on, as a notification).
--  5. Batch milestones: "8 of 12 students completed week 2".
--  6. (app only) A certificate for completing the whole practice.
--  7. (app only) The day-by-day report and student list as an Excel file.
--  8. A short reflection after practice (a mood and one line), seen only by
--     the student, their teacher and admins (the check-in's own rules).
--
-- Safe to run more than once. Run after phase21_badges.sql, then verify.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Each person's language, and the reminder texts in Arabic and Hindi
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists preferred_lang text not null default 'en';
alter table public.profiles drop constraint if exists profiles_preferred_lang_check;
alter table public.profiles add constraint profiles_preferred_lang_check check (preferred_lang in ('en', 'ar', 'hi'));
grant update (preferred_lang) on public.profiles to authenticated;

alter table public.organisations
  add column if not exists reminder_morning_text_ar text,
  add column if not exists reminder_morning_text_hi text,
  add column if not exists reminder_evening_text_ar text,
  add column if not exists reminder_evening_text_hi text;
alter table public.organisations drop constraint if exists organisations_reminder_text_lang_check;
alter table public.organisations add constraint organisations_reminder_text_lang_check check (
  coalesce(char_length(reminder_morning_text_ar), 0) <= 200 and coalesce(char_length(reminder_morning_text_hi), 0) <= 200
  and coalesce(char_length(reminder_evening_text_ar), 0) <= 200 and coalesce(char_length(reminder_evening_text_hi), 0) <= 200
);

-- ----------------------------------------------------------------------------
-- 8. A short reflection on a check-in (the student writes it on their own row)
-- ----------------------------------------------------------------------------
alter table public.checkins
  add column if not exists mood text,
  add column if not exists note text;
alter table public.checkins drop constraint if exists checkins_reflection_check;
alter table public.checkins add constraint checkins_reflection_check check (
  (mood is null or mood in ('calm', 'joyful', 'grateful', 'restless', 'tired'))
  and (note is null or char_length(note) <= 280)
);

-- ----------------------------------------------------------------------------
-- 4. Encouragement from a teacher
-- ----------------------------------------------------------------------------
create table if not exists public.encouragements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  from_id uuid references public.profiles(id) on delete set null,
  to_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('quiet', 'week', 'note')),
  message text not null check (char_length(btrim(message)) between 1 and 300),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  pushed_at timestamptz
);
create index if not exists encouragements_to_idx on public.encouragements (to_id, created_at desc);
create index if not exists encouragements_push_idx on public.encouragements (created_at) where pushed_at is null;
alter table public.encouragements enable row level security;
revoke all on public.encouragements from anon;
revoke insert, update, delete, truncate on public.encouragements from authenticated;
drop policy if exists "encouragements_read" on public.encouragements;
create policy "encouragements_read" on public.encouragements
  as permissive for select to authenticated
  using (
    to_id = (select auth.uid())
    or (org_id = (select public.get_current_user_org_id())
        and ((select public.is_org_admin()) or batch_id in (select public.my_teaching_batch_ids())))
  );

-- A teacher (of the batch) or an admin sends one message to some of the batch's students
create or replace function public.send_encouragement(p_batch uuid, p_students uuid[], p_kind text, p_message text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_n integer;
begin
  select org_id into v_org from public.batches
  where id = p_batch and org_id = public.get_current_user_org_id()
    and (teacher_id = auth.uid() or public.is_org_admin());
  if v_org is null then
    raise exception 'Only the batch''s teacher or an admin can send encouragement';
  end if;
  if p_kind not in ('quiet', 'week', 'note') or char_length(btrim(coalesce(p_message, ''))) not between 1 and 300 then
    raise exception 'Please write a message (up to 300 characters)';
  end if;
  insert into public.encouragements (org_id, batch_id, from_id, to_id, kind, message)
  select v_org, p_batch, auth.uid(), e.student_id, p_kind, btrim(p_message)
  from public.enrolments e
  where e.batch_id = p_batch and e.student_id = any (coalesce(p_students, '{}'));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function public.send_encouragement(uuid, uuid[], text, text) from public, anon;
grant execute on function public.send_encouragement(uuid, uuid[], text, text) to authenticated;

-- The student has read it
create or replace function public.mark_encouragement_seen(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.encouragements set seen_at = coalesce(seen_at, now()) where id = p_id and to_id = auth.uid();
$$;
revoke execute on function public.mark_encouragement_seen(uuid) from public, anon;
grant execute on function public.mark_encouragement_seen(uuid) to authenticated;

-- For the sender: messages of the last day not pushed yet, with the phones they go to
create or replace function public.pending_encouragements()
returns table (id uuid, org_id uuid, app_name text, message text, teacher text, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select n.id, n.org_id, o.app_name, n.message, coalesce(t.full_name, ''), s.endpoint, s.p256dh, s.auth
  from public.encouragements n
  join public.organisations o on o.id = n.org_id
  left join public.profiles t on t.id = n.from_id
  left join public.push_subscriptions s on s.user_id = n.to_id
  where n.pushed_at is null and n.created_at > now() - interval '1 day';
$$;
create or replace function public.finish_encouragements(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update public.encouragements set pushed_at = now() where id = any (coalesce(p_ids, '{}'));
$$;
revoke execute on function public.pending_encouragements() from public, anon, authenticated;
revoke execute on function public.finish_encouragements(uuid[]) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Batch milestones: per finished full week, how many students practised all 7 days
--    Members of the batch (its students, teacher, admins) see the counts, never names.
-- ----------------------------------------------------------------------------
create or replace function public.batch_milestones(p_batch uuid)
returns table (week integer, completed integer, students integer)
language plpgsql stable security definer set search_path = public as $$
declare
  b record;
  v_day integer;
begin
  select bt.id, bt.org_id, bt.teacher_id, bt.start_date, c.duration_days, c.has_practice_track, o.timezone
  into b
  from public.batches bt join public.courses c on c.id = bt.course_id join public.organisations o on o.id = bt.org_id
  where bt.id = p_batch;
  if b.id is null or not b.has_practice_track
     or not (b.teacher_id = auth.uid()
             or (b.org_id = public.get_current_user_org_id() and public.is_org_admin())
             or exists (select 1 from public.enrolments e where e.batch_id = p_batch and e.student_id = auth.uid())) then
    return;
  end if;
  v_day := (now() at time zone b.timezone)::date - b.start_date + 1;
  return query
  select w.n::integer,
         (select count(*)::integer from (
            select k.student_id from public.checkins k
            join public.enrolments e on e.batch_id = k.batch_id and e.student_id = k.student_id
            where k.batch_id = p_batch and (k.morning or k.evening) and k.day_number between 7 * w.n - 6 and 7 * w.n
            group by k.student_id having count(distinct k.day_number) = 7) x),
         (select count(*)::integer from public.enrolments e where e.batch_id = p_batch)
  from generate_series(1, least(b.duration_days / 7, greatest(0, v_day / 7))) w(n);
end;
$$;
revoke execute on function public.batch_milestones(uuid) from public, anon;
grant execute on function public.batch_milestones(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 1 + 3. Reminder recipients with their language (the sender skips the Evening
--        reminder for people who already ticked today)
-- ----------------------------------------------------------------------------
drop function if exists public.reminder_recipients(uuid);
create function public.reminder_recipients(p_org uuid)
returns table (
  endpoint text, p256dh text, auth text,
  practice_day integer, duration_days integer, week_number integer,
  week_done integer, week_open_days integer, week_unbroken boolean,
  today_morning boolean, today_evening boolean, lang text
)
language sql stable security definer set search_path = public as $$
  with running as (
    select distinct on (s.endpoint)
      s.endpoint, s.p256dh, s.auth, e.batch_id, e.student_id, c.duration_days, p.preferred_lang,
      ((now() at time zone o.timezone)::date - b.start_date + 1)::integer as day
    from public.push_subscriptions s
    join public.profiles p on p.id = s.user_id
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
         coalesce((select k.evening from public.checkins k where k.batch_id = r.batch_id and k.student_id = r.student_id and k.day_number = r.day), false),
         r.preferred_lang
  from running r;
$$;
revoke execute on function public.reminder_recipients(uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.reminder_recipients(uuid) to service_role;
    grant execute on function public.pending_encouragements() to service_role;
    grant execute on function public.finish_encouragements(uuid[]) to service_role;
  end if;
end $$;
