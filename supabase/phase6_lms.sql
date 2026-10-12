-- ============================================================================
-- Sadhana Mandala: Phase 6 migration (LMS: modules, lessons, progress)
--
-- SPEC.md "LMS": each programme has its own learning modules made of lessons
-- (text, video link), unlocked by day or by finishing the previous module,
-- with progress per student.
--
-- - lesson_modules: modules of a programme, each with an unlock rule:
--     'always'     open as soon as the student is enrolled
--     'day'        opens on day N of the student's batch of that programme
--     'sequential' opens when every lesson of the previous module is done
-- - lessons gain module_id, sort_order and estimated_minutes. Module lessons
--   are stored with scope 'course' and the programme's course_id.
-- - lesson_progress: one row per lesson a student has completed.
-- - Locked lessons cannot be read by students (restrictive policy), and
--   progress can only be recorded for lessons the student can open.
-- - Admins and teachers manage modules and module lessons (same as
--   programmes, decision 2026-10-12).
--
-- Only adds tables, columns, functions and policies; nothing is dropped.
-- Safe to run more than once. Run after supabase/phase5_programmes.sql.
-- ============================================================================

create table if not exists public.lesson_modules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer not null default 100,
  unlock_rule text not null default 'always' check (unlock_rule in ('always', 'day', 'sequential')),
  unlock_day integer check (unlock_day is null or unlock_day >= 1),
  published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_modules_day_rule check (unlock_rule <> 'day' or unlock_day is not null)
);
create index if not exists lesson_modules_course_idx on public.lesson_modules (course_id, sort_order);

alter table public.lessons
  add column if not exists module_id uuid references public.lesson_modules(id) on delete cascade,
  add column if not exists sort_order integer not null default 100,
  add column if not exists estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0);
create index if not exists lessons_module_idx on public.lessons (module_id, sort_order);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);
create index if not exists lesson_progress_student_idx on public.lesson_progress (student_id);

alter table public.lesson_modules enable row level security;
alter table public.lesson_progress enable row level security;

-- ----------------------------------------------------------------------------
-- Helpers (security definer, so policies never recurse)
-- ----------------------------------------------------------------------------
-- Caller is an admin or a teacher (staff manage programmes and their content)
create or replace function public.is_org_staff()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select role in ('admin', 'teacher') from public.profiles where id = auth.uid()), false);
$$;

-- Highest current day number over the caller's batches of a programme
create or replace function public.my_programme_day(p_course_id uuid)
returns integer language sql security definer stable set search_path = public as $$
  select max(((now() at time zone coalesce(o.timezone, 'Asia/Dubai'))::date - b.start_date) + 1)
  from public.enrolments e
  join public.batches b on b.id = e.batch_id
  join public.organisations o on o.id = b.org_id
  where e.student_id = auth.uid() and b.course_id = p_course_id;
$$;

-- Caller has completed every published lesson of a module
create or replace function public.my_module_complete(p_module_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select not exists (
    select 1 from public.lessons l
    where l.module_id = p_module_id and l.published
      and not exists (select 1 from public.lesson_progress p
                      where p.lesson_id = l.id and p.student_id = auth.uid())
  );
$$;

-- A module is open for the caller (students only; staff always see everything)
create or replace function public.module_unlocked_for_me(p_module_id uuid)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare
  m record;
  v_day integer;
  v_prev uuid;
begin
  select * into m from public.lesson_modules where id = p_module_id;
  if m.id is null or not m.published or not public.is_enrolled_in_course(m.course_id) then
    return false;
  end if;

  if m.unlock_rule = 'always' then
    return true;
  elsif m.unlock_rule = 'day' then
    v_day := public.my_programme_day(m.course_id);
    return v_day is not null and v_day >= m.unlock_day;
  else
    -- 'sequential': the previous published module (by display order) must be complete
    select id into v_prev from public.lesson_modules
    where course_id = m.course_id and published and id <> m.id
      and (sort_order, created_at, id) < (m.sort_order, m.created_at, m.id)
    order by sort_order desc, created_at desc, id desc
    limit 1;
    return v_prev is null or public.my_module_complete(v_prev);
  end if;
end;
$$;

revoke execute on function public.is_org_staff(), public.my_programme_day(uuid),
  public.my_module_complete(uuid), public.module_unlocked_for_me(uuid) from public, anon;
grant execute on function public.is_org_staff(), public.my_programme_day(uuid),
  public.my_module_complete(uuid), public.module_unlocked_for_me(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Policies (created only if missing; nothing dropped)
-- ----------------------------------------------------------------------------
do $$
begin
  -- Modules: staff manage; enrolled students read published modules of their programmes
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lesson_modules' and policyname = 'modules_staff_manage') then
    create policy "modules_staff_manage" on public.lesson_modules
      for all to authenticated
      using (org_id = public.get_current_user_org_id() and public.is_org_staff())
      with check (org_id = public.get_current_user_org_id() and public.is_org_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lesson_modules' and policyname = 'modules_student_select') then
    create policy "modules_student_select" on public.lesson_modules
      for select to authenticated
      using (org_id = public.get_current_user_org_id() and published and public.is_enrolled_in_course(course_id));
  end if;

  -- Module lessons: staff manage them (scope 'course' lessons of any programme in the org)
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lessons' and policyname = 'lessons_staff_module_manage') then
    create policy "lessons_staff_module_manage" on public.lessons
      for all to authenticated
      using (org_id = public.get_current_user_org_id() and public.is_org_staff() and module_id is not null)
      with check (org_id = public.get_current_user_org_id() and public.is_org_staff() and scope = 'course' and module_id is not null);
  end if;
  -- Locked module lessons are hidden from students (restrictive: applies on top of lessons_select)
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lessons' and policyname = 'lessons_module_unlocked') then
    create policy "lessons_module_unlocked" on public.lessons
      as restrictive for select to authenticated
      using (module_id is null or public.is_org_staff() or public.module_unlocked_for_me(module_id));
  end if;

  -- Progress: students record and undo their own, for lessons they can open;
  -- teachers see their students' progress; admins see all in the org
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lesson_progress' and policyname = 'progress_select') then
    create policy "progress_select" on public.lesson_progress
      for select to authenticated
      using (org_id = public.get_current_user_org_id()
             and (student_id = auth.uid() or public.is_org_admin() or public.teaches_student(student_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lesson_progress' and policyname = 'progress_insert_own') then
    create policy "progress_insert_own" on public.lesson_progress
      for insert to authenticated
      with check (student_id = auth.uid() and org_id = public.get_current_user_org_id()
                  and exists (select 1 from public.lessons l
                              where l.id = lesson_id and l.module_id is not null and l.published
                                and public.module_unlocked_for_me(l.module_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lesson_progress' and policyname = 'progress_delete_own') then
    create policy "progress_delete_own" on public.lesson_progress
      for delete to authenticated
      using (student_id = auth.uid());
  end if;
end $$;
