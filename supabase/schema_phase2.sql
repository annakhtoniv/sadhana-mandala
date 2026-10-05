-- Sadhana Mandala: Phase 2 Schema & Migration
-- Courses, Batches, Invites, Enrolments, Join Code, and Auto-mapping

-- ============================================================================
-- 1. COURSES
-- ============================================================================
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  description text,
  duration_days integer not null default 40 check (duration_days > 0),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 2. BATCHES
-- ============================================================================
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  start_date date not null,
  join_code text not null,
  created_at timestamptz not null default now(),
  unique(org_id, join_code)
);

-- ============================================================================
-- 3. BATCH INVITES
-- ============================================================================
create table if not exists public.batch_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  email text not null,
  claimed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(batch_id, email)
);

-- ============================================================================
-- 4. ENROLMENTS
-- ============================================================================
create table if not exists public.enrolments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('invite', 'code', 'manual')),
  joined_at timestamptz not null default now(),
  unique(batch_id, student_id)
);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
alter table public.courses enable row level security;
alter table public.batches enable row level security;
alter table public.batch_invites enable row level security;
alter table public.enrolments enable row level security;

-- Courses: Anyone in org can read courses; Admins full control
drop policy if exists "Users can read org courses" on public.courses;
create policy "Users can read org courses"
  on public.courses for select
  to authenticated
  using (org_id = public.get_current_user_org_id());

drop policy if exists "Admins can manage org courses" on public.courses;
create policy "Admins can manage org courses"
  on public.courses for all
  to authenticated
  using (org_id = public.get_current_user_org_id() and public.get_current_user_role() = 'admin')
  with check (org_id = public.get_current_user_org_id() and public.get_current_user_role() = 'admin');

-- Batches:
-- Teachers: full control of own batches
drop policy if exists "Teachers can manage own batches" on public.batches;
create policy "Teachers can manage own batches"
  on public.batches for all
  to authenticated
  using (
    org_id = public.get_current_user_org_id() and 
    (teacher_id = auth.uid() or public.get_current_user_role() = 'admin')
  )
  with check (
    org_id = public.get_current_user_org_id() and 
    (teacher_id = auth.uid() or public.get_current_user_role() = 'admin')
  );

-- Students: can read batches they are enrolled in, or query batch to join
drop policy if exists "Students can read enrolled batches" on public.batches;
create policy "Students can read enrolled batches"
  on public.batches for select
  to authenticated
  using (
    org_id = public.get_current_user_org_id() and
    (
      id in (select batch_id from public.enrolments where student_id = auth.uid()) or
      teacher_id = auth.uid() or
      public.get_current_user_role() = 'admin'
    )
  );

-- Batch Invites:
-- Teachers manage invites for their batches; Admins manage all; Students read own invite
drop policy if exists "Teachers manage batch invites" on public.batch_invites;
create policy "Teachers manage batch invites"
  on public.batch_invites for all
  to authenticated
  using (
    org_id = public.get_current_user_org_id() and
    (
      batch_id in (select id from public.batches where teacher_id = auth.uid()) or
      public.get_current_user_role() = 'admin'
    )
  )
  with check (
    org_id = public.get_current_user_org_id() and
    (
      batch_id in (select id from public.batches where teacher_id = auth.uid()) or
      public.get_current_user_role() = 'admin'
    )
  );

drop policy if exists "Students can read own batch invites" on public.batch_invites;
create policy "Students can read own batch invites"
  on public.batch_invites for select
  to authenticated
  using (
    org_id = public.get_current_user_org_id() and
    lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

-- Enrolments:
-- Students read and create own enrolment
drop policy if exists "Students read own enrolments" on public.enrolments;
create policy "Students read own enrolments"
  on public.enrolments for select
  to authenticated
  using (student_id = auth.uid() or public.get_current_user_role() = 'admin');

-- Teachers read enrolments of students in own batches only
drop policy if exists "Teachers read batch enrolments" on public.enrolments;
create policy "Teachers read batch enrolments"
  on public.enrolments for select
  to authenticated
  using (
    batch_id in (select id from public.batches where teacher_id = auth.uid())
  );

drop policy if exists "Admins manage all enrolments" on public.enrolments;
create policy "Admins manage all enrolments"
  on public.enrolments for all
  to authenticated
  using (org_id = public.get_current_user_org_id() and public.get_current_user_role() = 'admin')
  with check (org_id = public.get_current_user_org_id() and public.get_current_user_role() = 'admin');

-- Allow students to enrol via verified functions
drop policy if exists "Users can insert own enrolment" on public.enrolments;
create policy "Users can insert own enrolment"
  on public.enrolments for insert
  to authenticated
  with check (
    student_id = auth.uid() and 
    org_id = public.get_current_user_org_id()
  );

-- Also allow teachers to view profiles of students enrolled in their batches
drop policy if exists "Teachers can view profiles of students in own batches" on public.profiles;
create policy "Teachers can view profiles of students in own batches"
  on public.profiles for select
  to authenticated
  using (
    id in (
      select e.student_id 
      from public.enrolments e
      join public.batches b on b.id = e.batch_id
      where b.teacher_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. BUSINESS LOGIC HELPER FUNCTIONS
-- ============================================================================

-- Function: Claim pending invites for current user on sign-in
create or replace function public.claim_pending_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_org_id uuid;
  v_claimed_count integer := 0;
  r record;
begin
  if v_user_id is null then
    return 0;
  end if;

  select email, org_id into v_user_email, v_org_id
  from public.profiles
  where id = v_user_id;

  if v_user_email is null or v_org_id is null then
    return 0;
  end if;

  for r in (
    select id, batch_id
    from public.batch_invites
    where org_id = v_org_id
      and lower(email) = lower(v_user_email)
      and claimed_by is null
  ) loop
    -- Enrol user into batch
    insert into public.enrolments (org_id, batch_id, student_id, source)
    values (v_org_id, r.batch_id, v_user_id, 'invite')
    on conflict (batch_id, student_id) do nothing;

    -- Mark invite claimed
    update public.batch_invites
    set claimed_by = v_user_id
    where id = r.id;

    v_claimed_count := v_claimed_count + 1;
  end loop;

  return v_claimed_count;
end;
$$;

-- Function: Join a batch using join code
create or replace function public.join_batch_by_code(p_join_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_batch record;
  v_existing_enrolment uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required to join a batch';
  end if;

  select org_id into v_org_id
  from public.profiles
  where id = v_user_id;

  -- Locate batch by join_code inside caller's organisation
  select b.*, c.name as course_name, c.duration_days
  into v_batch
  from public.batches b
  join public.courses c on c.id = b.course_id
  where b.org_id = v_org_id
    and upper(b.join_code) = upper(trim(p_join_code))
  limit 1;

  if v_batch.id is null then
    raise exception 'Invalid join code for this organisation';
  end if;

  -- Insert enrolment
  insert into public.enrolments (org_id, batch_id, student_id, source)
  values (v_org_id, v_batch.id, v_user_id, 'code')
  on conflict (batch_id, student_id) do nothing;

  return json_build_object(
    'batch_id', v_batch.id,
    'batch_name', v_batch.name,
    'course_name', v_batch.course_name,
    'duration_days', v_batch.duration_days,
    'start_date', v_batch.start_date
  );
end;
$$;

-- Function: Teacher pastes student emails into a batch (adds invites & auto-enrols matching accounts)
create or replace function public.add_batch_invites(p_batch_id uuid, p_emails text[])
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_is_teacher boolean;
  v_email text;
  v_clean_email text;
  v_target_profile_id uuid;
  v_total_added integer := 0;
  v_total_auto_enrolled integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select org_id into v_org_id from public.profiles where id = v_user_id;

  -- Check permission: caller must be teacher of batch or admin
  select (b.teacher_id = v_user_id or p.role = 'admin')
  into v_is_teacher
  from public.batches b
  join public.profiles p on p.id = v_user_id
  where b.id = p_batch_id and b.org_id = v_org_id;

  if not coalesce(v_is_teacher, false) then
    raise exception 'Permission denied: Only the batch teacher or admin can invite students';
  end if;

  foreach v_email in array p_emails loop
    v_clean_email := lower(trim(v_email));
    if v_clean_email <> '' and v_clean_email like '%@%' then
      -- Check if user profile already exists with this email
      select id into v_target_profile_id
      from public.profiles
      where org_id = v_org_id and lower(email) = v_clean_email
      limit 1;

      -- Insert into batch_invites
      insert into public.batch_invites (org_id, batch_id, email, claimed_by)
      values (v_org_id, p_batch_id, v_clean_email, v_target_profile_id)
      on conflict (batch_id, email) do update set
        claimed_by = coalesce(batch_invites.claimed_by, excluded.claimed_by);

      v_total_added := v_total_added + 1;

      -- If account already exists, auto-enrol immediately!
      if v_target_profile_id is not null then
        insert into public.enrolments (org_id, batch_id, student_id, source)
        values (v_org_id, p_batch_id, v_target_profile_id, 'invite')
        on conflict (batch_id, student_id) do nothing;

        v_total_auto_enrolled := v_total_auto_enrolled + 1;
      end if;
    end if;
  end loop;

  return json_build_object(
    'total_invites', v_total_added,
    'total_auto_enrolled', v_total_auto_enrolled
  );
end;
$$;

-- ============================================================================
-- 7. DEFAULT SEED DATA (Organisation A: 1 Course)
-- ============================================================================
do $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from public.organisations where slug = 'sadhana-mandala' limit 1;
  if v_org_id is not null then
    insert into public.courses (org_id, name, description, duration_days)
    values (
      v_org_id,
      '40-Day Sadhana Practice',
      'A transformative daily meditation and awareness commitment for forty days.',
      40
    ) on conflict do nothing;
  end if;
end;
$$;
