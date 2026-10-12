-- ============================================================================
-- Sadhana Mandala: Phase 7 migration (follow-ups per programme)
--
-- SPEC.md "Follow-ups": a mix, different per programme. Each programme has a
-- follow-up plan made of steps that fall due on a day of each batch:
--   'session'  a group follow-up session; the teacher schedules it per batch
--              (date, time, place or link) and marks it held
--   'personal' a personal follow-up with every student (e.g. a check-in call);
--              the teacher records it per student with private notes
--   'reminder' a practice reminder students see in the app from that day
--
-- - followup_steps: the plan of a programme (admins and teachers manage it)
-- - followup_records: what happened in a batch: a session scheduled or held
--   (student_id null) or a personal follow-up per student
-- - Records and notes are never visible to students. Students get their
--   batch's sessions (title, when, where, status) through my_batch_sessions().
--
-- Only adds tables, functions and policies; nothing is dropped.
-- Safe to run more than once. Run after supabase/phase6_lms.sql.
-- ============================================================================

create table if not exists public.followup_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  kind text not null check (kind in ('session', 'personal', 'reminder')),
  title text not null,
  description text,
  offset_day integer not null check (offset_day >= 1),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists followup_steps_course_idx on public.followup_steps (course_id, offset_day);

create table if not exists public.followup_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  step_id uuid not null references public.followup_steps(id) on delete cascade,
  -- null for a session (one record per batch); set for a personal follow-up
  student_id uuid references public.profiles(id) on delete cascade,
  status text not null check (status in ('scheduled', 'done', 'skipped')),
  scheduled_for timestamptz,
  location text,
  notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint followup_records_one_per_target unique nulls not distinct (batch_id, step_id, student_id)
);
create index if not exists followup_records_batch_idx on public.followup_records (batch_id);

alter table public.followup_steps enable row level security;
alter table public.followup_records enable row level security;

do $$
begin
  -- Plan: everyone in the organisation reads it (students see reminders and
  -- session titles); admins and teachers manage it
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'followup_steps' and policyname = 'followup_steps_select') then
    create policy "followup_steps_select" on public.followup_steps
      for select to authenticated using (org_id = public.get_current_user_org_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'followup_steps' and policyname = 'followup_steps_staff_manage') then
    create policy "followup_steps_staff_manage" on public.followup_steps
      for all to authenticated
      using (org_id = public.get_current_user_org_id() and public.is_org_staff())
      with check (org_id = public.get_current_user_org_id() and public.is_org_staff());
  end if;

  -- Records: the batch teacher and admins manage them
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'followup_records' and policyname = 'followup_records_staff_manage') then
    create policy "followup_records_staff_manage" on public.followup_records
      for all to authenticated
      using (org_id = public.get_current_user_org_id() and (public.is_org_admin() or public.is_batch_teacher(batch_id)))
      with check (org_id = public.get_current_user_org_id() and (public.is_org_admin() or public.is_batch_teacher(batch_id)));
  end if;
end $$;

-- Follow-up sessions of a batch the caller is enrolled in: what students may
-- see (title, description, day, when, where, status), without teacher notes.
create or replace function public.my_batch_sessions(p_batch_id uuid)
returns table (
  step_id uuid,
  title text,
  description text,
  offset_day integer,
  status text,
  scheduled_for timestamptz,
  location text
)
language sql security definer stable set search_path = public as $$
  select s.id, s.title, s.description, s.offset_day, r.status, r.scheduled_for, r.location
  from public.batches b
  join public.followup_steps s on s.course_id = b.course_id and s.kind = 'session' and s.is_active
  left join public.followup_records r on r.batch_id = b.id and r.step_id = s.id and r.student_id is null
  where b.id = p_batch_id
    and b.org_id = public.get_current_user_org_id()
    and (public.is_enrolled_in_batch(b.id) or public.is_org_admin() or public.is_batch_teacher(b.id))
  order by s.offset_day, s.sort_order;
$$;
revoke execute on function public.my_batch_sessions(uuid) from public, anon;
grant execute on function public.my_batch_sessions(uuid) to authenticated;
