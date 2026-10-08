-- Sadhana Mandala: Phase 3 Schema & Policies
-- Student Daily Check-in, Streaks & Idempotent Recording

-- ============================================================================
-- 1. CHECKINS TABLE
-- ============================================================================
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  day_number integer not null check (day_number > 0),
  status text not null check (status in ('done', 'not_yet', 'rest')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, batch_id, day_number)
);

-- Index for speedy queries by student & batch
create index if not exists idx_checkins_student_batch on public.checkins(student_id, batch_id);
create index if not exists idx_checkins_batch_day on public.checkins(batch_id, day_number);

-- ============================================================================
-- 2. AUTOMATIC UPDATED_AT TIMESTAMP TRIGGER
-- ============================================================================
create or replace function public.handle_checkin_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_checkins_updated_at on public.checkins;
create trigger tr_checkins_updated_at
  before update on public.checkins
  for each row execute function public.handle_checkin_updated_at();

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
alter table public.checkins enable row level security;

-- Student RLS: Read own check-ins
drop policy if exists "Students can read own checkins" on public.checkins;
create policy "Students can read own checkins"
  on public.checkins for select
  to authenticated
  using (
    student_id = auth.uid() or
    public.get_current_user_role() = 'admin'
  );

-- Student RLS: Insert own check-ins inside own organization
drop policy if exists "Students can insert own checkins" on public.checkins;
create policy "Students can insert own checkins"
  on public.checkins for insert
  to authenticated
  with check (
    student_id = auth.uid() and
    org_id = public.get_current_user_org_id()
  );

-- Student RLS: Update own check-ins inside own organization (idempotent changing of answer)
drop policy if exists "Students can update own checkins" on public.checkins;
create policy "Students can update own checkins"
  on public.checkins for update
  to authenticated
  using (
    student_id = auth.uid() and
    org_id = public.get_current_user_org_id()
  )
  with check (
    student_id = auth.uid() and
    org_id = public.get_current_user_org_id()
  );

-- Teacher RLS: Teachers can read check-ins of students enrolled in their batches
drop policy if exists "Teachers can read batch student checkins" on public.checkins;
create policy "Teachers can read batch student checkins"
  on public.checkins for select
  to authenticated
  using (
    batch_id in (select id from public.batches where teacher_id = auth.uid()) or
    public.get_current_user_role() = 'admin'
  );

-- Admin RLS: Admins have full access within their organisation
drop policy if exists "Admins manage all checkins" on public.checkins;
create policy "Admins manage all checkins"
  on public.checkins for all
  to authenticated
  using (
    org_id = public.get_current_user_org_id() and
    public.get_current_user_role() = 'admin'
  )
  with check (
    org_id = public.get_current_user_org_id() and
    public.get_current_user_role() = 'admin'
  );
