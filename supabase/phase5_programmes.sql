-- ============================================================================
-- Sadhana Mandala: Phase 5 migration (programme catalogue + multi-enrolment)
--
-- Turns the `courses` table into a configurable programme catalogue:
-- code, category, programme length, prerequisites, active flag, display order
-- and an optional daily practice track per programme (SPEC.md "Programmes").
-- Teachers can now add and edit programmes as well as admins.
-- Daily check-ins are only accepted for programmes that have a practice track.
--
-- Only adds columns, indexes and policies; nothing is dropped. Safe to run
-- more than once. Run after supabase/phase4_security.sql.
-- ============================================================================

do $$
declare
  v_first_run boolean := not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courses' and column_name = 'has_practice_track'
  );
begin
  alter table public.courses
    add column if not exists code text,
    add column if not exists category text not null default 'Programme',
    add column if not exists programme_days integer check (programme_days is null or programme_days > 0),
    add column if not exists has_practice_track boolean not null default false,
    add column if not exists practice_name text,
    add column if not exists prerequisite_ids uuid[] not null default '{}',
    add column if not exists is_active boolean not null default true,
    add column if not exists sort_order integer not null default 100,
    add column if not exists created_by uuid references public.profiles(id) on delete set null,
    add column if not exists updated_at timestamptz not null default now();

  -- Every course that existed before Phase 5 was a daily practice course
  -- (duration_days was its practice length), so keep its check-ins working.
  if v_first_run then
    update public.courses
    set has_practice_track = true,
        practice_name = duration_days || '-Day Practice';
  end if;
end $$;

comment on column public.courses.duration_days is
  'Length of the daily practice track in days (used only when has_practice_track is true)';
comment on column public.courses.programme_days is
  'Length of the programme itself in days, if known (e.g. 3 for a weekend programme)';

-- A programme code is unique inside an organisation (case-insensitive)
create unique index if not exists courses_org_code_key
  on public.courses (org_id, lower(code)) where code is not null;

-- Teachers can add and edit programmes too (decision 2026-10-12)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'courses'
                 and policyname = 'courses_teacher_manage') then
    create policy "courses_teacher_manage" on public.courses
      for all to authenticated
      using (org_id = public.get_current_user_org_id() and public.get_current_user_role() = 'teacher')
      with check (org_id = public.get_current_user_org_id() and public.get_current_user_role() = 'teacher');
  end if;
end $$;

-- Daily check-ins only for batches whose programme has a practice track,
-- and only within the track's length. Restrictive: applies on top of every
-- other insert/update policy, including the admin one.
create or replace function public.batch_accepts_checkin(p_batch_id uuid, p_day integer)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.batches b
    join public.courses c on c.id = b.course_id
    where b.id = p_batch_id
      and c.has_practice_track
      and p_day between 1 and c.duration_days
  );
$$;
revoke execute on function public.batch_accepts_checkin(uuid, integer) from public, anon;
grant execute on function public.batch_accepts_checkin(uuid, integer) to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'checkins'
                 and policyname = 'checkins_practice_track_only') then
    create policy "checkins_practice_track_only" on public.checkins
      as restrictive for insert to authenticated
      with check (public.batch_accepts_checkin(batch_id, day_number));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'checkins'
                 and policyname = 'checkins_practice_track_only_update') then
    create policy "checkins_practice_track_only_update" on public.checkins
      as restrictive for update to authenticated
      using (true)
      with check (public.batch_accepts_checkin(batch_id, day_number));
  end if;
end $$;
