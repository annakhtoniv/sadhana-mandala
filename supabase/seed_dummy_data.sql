-- ============================================================================
-- Sadhana Mandala: Complete Dummy Data Seed Script (Phase 4 Spec)
-- Creates full dummy data for:
--  - Organisation A (Sadhana Mandala) & Organisation B (Prana Flow)
--  - Courses, Teachers, Batches (Finished Day 40, Active Day 23, Fresh Day 2, Day 1)
--  - 30 clearly fictional students in Org A & 5 students in Org B
--  - Enrolments, pending & claimed invites
--  - Full Check-in histories (streaks, rest days, and 5 QUIET students)
--  - Daily Lessons (General, Course, and Batch-specific)
--  - Auto-enrols the logged-in admin user so all roles can be tested immediately
-- ============================================================================

-- 1. Ensure required extensions & drop profiles foreign key to allow dummy profiles
create extension if not exists "pgcrypto";
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- 2. Ensure tables checkins and lessons exist (per SPEC.md data model)
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

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  body text not null default '',
  video_url text,
  scope text not null check (scope in ('general', 'course', 'batch')),
  course_id uuid references public.courses(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete cascade,
  day_number integer,
  published boolean not null default true,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS for checkins and lessons
alter table public.checkins enable row level security;
alter table public.lessons enable row level security;

-- Checkins RLS
drop policy if exists "Students can read own checkins" on public.checkins;
create policy "Students can read own checkins"
  on public.checkins for select
  to authenticated
  using (student_id = auth.uid() or public.get_current_user_role() = 'admin');

drop policy if exists "Students can insert own checkins" on public.checkins;
create policy "Students can insert own checkins"
  on public.checkins for insert
  to authenticated
  with check (student_id = auth.uid() and org_id = public.get_current_user_org_id());

drop policy if exists "Students can update own checkins" on public.checkins;
create policy "Students can update own checkins"
  on public.checkins for update
  to authenticated
  using (student_id = auth.uid() and org_id = public.get_current_user_org_id())
  with check (student_id = auth.uid() and org_id = public.get_current_user_org_id());

drop policy if exists "Teachers can read batch student checkins" on public.checkins;
create policy "Teachers can read batch student checkins"
  on public.checkins for select
  to authenticated
  using (
    batch_id in (select id from public.batches where teacher_id = auth.uid()) or
    public.get_current_user_role() = 'admin'
  );

drop policy if exists "Admins manage all checkins" on public.checkins;
create policy "Admins manage all checkins"
  on public.checkins for all
  to authenticated
  using (org_id = public.get_current_user_org_id() and public.get_current_user_role() = 'admin')
  with check (org_id = public.get_current_user_org_id() and public.get_current_user_role() = 'admin');

-- Lessons RLS
drop policy if exists "Users read published lessons in org" on public.lessons;
create policy "Users read published lessons in org"
  on public.lessons for select
  to authenticated
  using (
    org_id = public.get_current_user_org_id() and (
      scope = 'general' or
      (scope = 'course' and course_id in (select b.course_id from public.enrolments e join public.batches b on b.id = e.batch_id where e.student_id = auth.uid())) or
      (scope = 'batch' and batch_id in (select batch_id from public.enrolments where student_id = auth.uid())) or
      public.get_current_user_role() in ('teacher', 'admin')
    )
  );

drop policy if exists "Teachers and Admins manage lessons" on public.lessons;
create policy "Teachers and Admins manage lessons"
  on public.lessons for all
  to authenticated
  using (
    org_id = public.get_current_user_org_id() and (
      author_id = auth.uid() or
      public.get_current_user_role() in ('teacher', 'admin')
    )
  )
  with check (
    org_id = public.get_current_user_org_id() and (
      author_id = auth.uid() or
      public.get_current_user_role() in ('teacher', 'admin')
    )
  );

-- Also ensure Teacher can read enrolled students' profiles
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
    ) or
    public.get_current_user_role() = 'admin'
  );

-- ============================================================================
-- 3. SEED DATA EXECUTION BLOCK
-- ============================================================================
do $$
declare
  v_org_a_id uuid;
  v_org_b_id uuid;

  -- Courses
  v_course_a1_id uuid;
  v_course_a2_id uuid;
  v_course_b1_id uuid;

  -- Teacher & Admin IDs
  v_teacher_a1_id uuid := 'b0000000-0000-0000-0000-000000000001';
  v_teacher_a2_id uuid := 'b0000000-0000-0000-0000-000000000002';
  v_admin_a_id    uuid := 'b0000000-0000-0000-0000-000000000003';
  v_teacher_b_id  uuid := 'c0000000-0000-0000-0000-000000000001';
  v_admin_b_id    uuid := 'c0000000-0000-0000-0000-000000000002';

  -- Batches in Org A
  v_batch_day23_id uuid := 'd1000000-0000-0000-0000-000000000001'; -- Autumn Awakening (Day 23)
  v_batch_day40_id uuid := 'd1000000-0000-0000-0000-000000000002'; -- Summer Solstice (Finished Day 40)
  v_batch_day2_id  uuid := 'd1000000-0000-0000-0000-000000000003'; -- New Moon (Day 2)
  v_batch_day1_id  uuid := 'd1000000-0000-0000-0000-000000000004'; -- October Sadhana (Day 1)

  -- Batch in Org B
  v_batch_b_id     uuid := 'd2000000-0000-0000-0000-000000000001'; -- Prana Sunrise

  -- Current user (if one already signed in)
  v_my_user_id uuid;
  v_student_id uuid;
  v_student_idx integer;

  -- 30 Fictional Names
  v_names text[] := array[
    'Aarav Mehta', 'Maya Lin', 'Leo Dubois', 'Elena Rostova', 'Fatima Al-Mansoori',
    'David Kim', 'Aisha Bello', 'Carlos Mendoza', 'Zoe Jenkins', 'Vikram Rao',
    'Sarah Connor', 'Kenji Takahashi', 'Chloe Martin', 'Tariq Al-Hashimi', 'Sofia Rossi',
    'Lucas Silva', 'Amara Okafor', 'Liam O''Connor', 'Meera Krishnan', 'Jonas Mueller',
    'Layla Haddad', 'Gabriel Santos', 'Nina Petrova', 'Ethan Wright', 'Kavita Sharma',
    'Oliver Hansen', 'Yasmin Noor', 'Alexander Petrov', 'Hannah Abbott', 'Daniel Vance'
  ];

  v_day integer;
  v_status text;
begin
  -- --------------------------------------------------------------------------
  -- 3.1 ORGANISATIONS
  -- --------------------------------------------------------------------------
  -- Organisation A (Sadhana Mandala)
  insert into public.organisations (
    name, slug, app_name, primary_colour, accent_colour,
    support_email, checkin_question, footer_text, timezone, show_powered_by
  ) values (
    'Sadhana Mandala', 'sadhana-mandala', 'Sadhana Mandala',
    '#1c1917', '#059669', 'support@zyxenai.com',
    'Did you complete your daily practice today?',
    'Mindful daily practice and teacher guidance', 'Asia/Dubai', true
  )
  on conflict (slug) do update set
    primary_colour = '#1c1917',
    accent_colour = '#059669',
    checkin_question = 'Did you complete your daily practice today?',
    timezone = 'Asia/Dubai',
    show_powered_by = true
  returning id into v_org_a_id;

  -- Organisation B (Prana Flow Academy)
  insert into public.organisations (
    name, slug, app_name, primary_colour, accent_colour,
    support_email, checkin_question, footer_text, timezone, show_powered_by
  ) values (
    'Prana Flow Academy', 'prana-flow', 'Prana Flow',
    '#0f172a', '#d97706', 'support@pranaflow.example.com',
    'Have you practiced your mindful breathing today?',
    'Dedicated to conscious breath and vibrant presence', 'Asia/Dubai', false
  )
  on conflict (slug) do update set
    primary_colour = '#0f172a',
    accent_colour = '#d97706',
    checkin_question = 'Have you practiced your mindful breathing today?',
    timezone = 'Asia/Dubai',
    show_powered_by = false
  returning id into v_org_b_id;

  -- --------------------------------------------------------------------------
  -- 3.2 DETECT LOGGED IN USER
  -- --------------------------------------------------------------------------
  select id into v_my_user_id
  from public.profiles
  where email not like '%@example.com' and email not like '%@demo.local'
  order by created_at desc
  limit 1;

  -- If a real user is found, promote them to Admin in Org A and set consent
  if v_my_user_id is not null then
    update public.profiles
    set role = 'admin', consent_at = coalesce(consent_at, now()), org_id = v_org_a_id
    where id = v_my_user_id;

    insert into public.role_grants (org_id, email, role)
    select v_org_a_id, lower(email), 'admin'
    from public.profiles where id = v_my_user_id
    on conflict (org_id, email) do update set role = 'admin';
  end if;

  -- --------------------------------------------------------------------------
  -- 3.3 COURSES
  -- --------------------------------------------------------------------------
  -- Org A: 40-Day Sadhana Practice
  insert into public.courses (org_id, name, description, duration_days)
  values (
    v_org_a_id,
    '40-Day Sadhana Practice',
    'A transformative daily meditation and awareness commitment for forty days.',
    40
  )
  on conflict do nothing;

  -- Org A: 21-Day Mindfulness Starter
  insert into public.courses (org_id, name, description, duration_days)
  values (
    v_org_a_id,
    '21-Day Mindfulness Starter',
    'A gentle introduction to daily sitting, breath observation, and calm awareness.',
    21
  )
  on conflict do nothing;

  select id into v_course_a1_id from public.courses where org_id = v_org_a_id and duration_days = 40 limit 1;
  select id into v_course_a2_id from public.courses where org_id = v_org_a_id and duration_days = 21 limit 1;

  -- Org B Course
  insert into public.courses (org_id, name, description, duration_days)
  values (
    v_org_b_id,
    'Prana Foundation 30',
    'Deep pranayama breathwork and energetic alignment over 30 days.',
    30
  )
  on conflict do nothing;

  select id into v_course_b1_id from public.courses where org_id = v_org_b_id limit 1;

  -- --------------------------------------------------------------------------
  -- 3.4 TEACHERS & ADMINS PROFILES
  -- --------------------------------------------------------------------------
  -- Org A Teacher 1 (Ananda Sharma)
  insert into public.profiles (id, org_id, email, full_name, role, consent_at)
  values (v_teacher_a1_id, v_org_a_id, 'teacher.ananda@example.com', 'Ananda Sharma', 'teacher', now() - interval '60 days')
  on conflict (id) do update set role = 'teacher', full_name = 'Ananda Sharma';

  -- Org A Teacher 2 (Priya Patel)
  insert into public.profiles (id, org_id, email, full_name, role, consent_at)
  values (v_teacher_a2_id, v_org_a_id, 'teacher.priya@example.com', 'Priya Patel', 'teacher', now() - interval '60 days')
  on conflict (id) do update set role = 'teacher', full_name = 'Priya Patel';

  -- Org A Admin (Sadhana Admin)
  insert into public.profiles (id, org_id, email, full_name, role, consent_at)
  values (v_admin_a_id, v_org_a_id, 'admin@sadhana.zyxenai.com', 'Sadhana Admin', 'admin', now() - interval '60 days')
  on conflict (id) do update set role = 'admin', full_name = 'Sadhana Admin';

  -- Org B Teacher & Admin
  insert into public.profiles (id, org_id, email, full_name, role, consent_at)
  values (v_teacher_b_id, v_org_b_id, 'marcus@pranaflow.example.com', 'Marcus Vance', 'teacher', now() - interval '30 days')
  on conflict (id) do update set role = 'teacher', full_name = 'Marcus Vance';

  insert into public.profiles (id, org_id, email, full_name, role, consent_at)
  values (v_admin_b_id, v_org_b_id, 'admin@pranaflow.example.com', 'Prana Admin', 'admin', now() - interval '30 days')
  on conflict (id) do update set role = 'admin', full_name = 'Prana Admin';

  -- Role grants
  insert into public.role_grants (org_id, email, role)
  values
    (v_org_a_id, 'teacher.ananda@example.com', 'teacher'),
    (v_org_a_id, 'teacher.priya@example.com', 'teacher'),
    (v_org_a_id, 'admin@sadhana.zyxenai.com', 'admin'),
    (v_org_b_id, 'marcus@pranaflow.example.com', 'teacher'),
    (v_org_b_id, 'admin@pranaflow.example.com', 'admin')
  on conflict (org_id, email) do update set role = excluded.role;

  -- --------------------------------------------------------------------------
  -- 3.5 BATCHES (Org A: Day 40 Finished, Day 23 Active, Day 2 Fresh, Day 1 Today)
  -- --------------------------------------------------------------------------
  -- Batch 1: Autumn Awakening (Active at Day 23 -> start_date = current_date - 22)
  insert into public.batches (id, org_id, course_id, teacher_id, name, start_date, join_code)
  values (
    v_batch_day23_id,
    v_org_a_id,
    v_course_a1_id,
    coalesce(v_my_user_id, v_teacher_a1_id),
    'Autumn Awakening Cohort',
    current_date - 22,
    'AUTUMN23'
  )
  on conflict (id) do update set
    start_date = current_date - 22,
    teacher_id = coalesce(v_my_user_id, v_teacher_a1_id),
    join_code = 'AUTUMN23';

  -- Batch 2: Summer Solstice (Finished at Day 40 -> start_date = current_date - 40)
  insert into public.batches (id, org_id, course_id, teacher_id, name, start_date, join_code)
  values (
    v_batch_day40_id,
    v_org_a_id,
    v_course_a1_id,
    coalesce(v_my_user_id, v_teacher_a1_id),
    'Summer Solstice Sadhana',
    current_date - 40,
    'SUMMER40'
  )
  on conflict (id) do update set
    start_date = current_date - 40,
    teacher_id = coalesce(v_my_user_id, v_teacher_a1_id),
    join_code = 'SUMMER40';

  -- Batch 3: New Moon Mindfulness (Day 2 -> start_date = current_date - 1)
  insert into public.batches (id, org_id, course_id, teacher_id, name, start_date, join_code)
  values (
    v_batch_day2_id,
    v_org_a_id,
    v_course_a1_id,
    v_teacher_a2_id,
    'New Moon Mindfulness',
    current_date - 1,
    'MOON02'
  )
  on conflict (id) do update set
    start_date = current_date - 1,
    teacher_id = v_teacher_a2_id,
    join_code = 'MOON02';

  -- Batch 4: October Sadhana (Day 1 -> start_date = current_date)
  insert into public.batches (id, org_id, course_id, teacher_id, name, start_date, join_code)
  values (
    v_batch_day1_id,
    v_org_a_id,
    v_course_a1_id,
    coalesce(v_my_user_id, v_teacher_a1_id),
    'October Sadhana Cohort',
    current_date,
    'SADH40'
  )
  on conflict (id) do update set
    start_date = current_date,
    teacher_id = coalesce(v_my_user_id, v_teacher_a1_id),
    join_code = 'SADH40';

  -- Org B Batch: Prana Sunrise (Day 10 -> start_date = current_date - 9)
  insert into public.batches (id, org_id, course_id, teacher_id, name, start_date, join_code)
  values (
    v_batch_b_id,
    v_org_b_id,
    v_course_b1_id,
    v_teacher_b_id,
    'Prana Sunrise Cohort',
    current_date - 9,
    'PRANA10'
  )
  on conflict (id) do update set
    start_date = current_date - 9,
    teacher_id = v_teacher_b_id,
    join_code = 'PRANA10';

  -- --------------------------------------------------------------------------
  -- 3.6 30 FICTIONAL STUDENTS IN ORG A & 5 STUDENTS IN ORG B
  -- --------------------------------------------------------------------------
  for v_student_idx in 1..30 loop
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(v_student_idx::text, 12, '0'))::uuid;

    -- Insert student profile
    insert into public.profiles (id, org_id, email, full_name, role, consent_at)
    values (
      v_student_id,
      v_org_a_id,
      'student' || lpad(v_student_idx::text, 2, '0') || '@example.com',
      v_names[v_student_idx],
      'student',
      now() - interval '25 days'
    )
    on conflict (id) do update set
      full_name = v_names[v_student_idx],
      email = 'student' || lpad(v_student_idx::text, 2, '0') || '@example.com',
      role = 'student';

    -- Enrol all 30 students into Autumn Awakening (Day 23)
    insert into public.enrolments (org_id, batch_id, student_id, source, joined_at)
    values (
      v_org_a_id,
      v_batch_day23_id,
      v_student_id,
      case when v_student_idx % 3 = 0 then 'invite' when v_student_idx % 3 = 1 then 'code' else 'manual' end,
      now() - interval '23 days'
    )
    on conflict (batch_id, student_id) do nothing;

    -- Also enrol students 1-15 in the finished batch (Day 40)
    if v_student_idx <= 15 then
      insert into public.enrolments (org_id, batch_id, student_id, source, joined_at)
      values (
        v_org_a_id,
        v_batch_day40_id,
        v_student_id,
        'code',
        now() - interval '42 days'
      )
      on conflict (batch_id, student_id) do nothing;
    end if;

    -- Also enrol students 16-20 in the fresh batch (Day 2)
    if v_student_idx between 16 and 20 then
      insert into public.enrolments (org_id, batch_id, student_id, source, joined_at)
      values (
        v_org_a_id,
        v_batch_day2_id,
        v_student_id,
        'invite',
        now() - interval '2 days'
      )
      on conflict (batch_id, student_id) do nothing;
    end if;
  end loop;

  -- Enrol the logged-in user into Autumn Awakening (Day 23) so Student persona has rich data
  if v_my_user_id is not null then
    insert into public.enrolments (org_id, batch_id, student_id, source, joined_at)
    values (v_org_a_id, v_batch_day23_id, v_my_user_id, 'manual', now() - interval '23 days')
    on conflict (batch_id, student_id) do nothing;

    -- Add past check-ins for the logged-in user so they have a streak of 22 days!
    for v_day in 1..22 loop
      insert into public.checkins (org_id, student_id, batch_id, day_number, status, created_at, updated_at)
      values (
        v_org_a_id,
        v_my_user_id,
        v_batch_day23_id,
        v_day,
        case when v_day in (7, 14, 21) then 'rest' else 'done' end,
        (current_date - (23 - v_day))::timestamptz + time '07:30:00',
        (current_date - (23 - v_day))::timestamptz + time '07:30:00'
      )
      on conflict (student_id, batch_id, day_number) do update set status = excluded.status;
    end loop;
  end if;

  -- Org B: 5 Students
  for v_student_idx in 1..5 loop
    v_student_id := ('e0000000-0000-0000-0000-' || lpad(v_student_idx::text, 12, '0'))::uuid;

    insert into public.profiles (id, org_id, email, full_name, role, consent_at)
    values (
      v_student_id,
      v_org_b_id,
      'prana.student' || v_student_idx || '@example.com',
      case v_student_idx
        when 1 then 'Arjun Nair'
        when 2 then 'Beatrice Taylor'
        when 3 then 'Cyrus Chen'
        when 4 then 'Daphne Brooks'
        else 'Emre Kaya'
      end,
      'student',
      now() - interval '12 days'
    )
    on conflict (id) do update set role = 'student';

    insert into public.enrolments (org_id, batch_id, student_id, source, joined_at)
    values (v_org_b_id, v_batch_b_id, v_student_id, 'code', now() - interval '10 days')
    on conflict (batch_id, student_id) do nothing;

    -- Org B checkins for days 1..10
    for v_day in 1..10 loop
      insert into public.checkins (org_id, student_id, batch_id, day_number, status, created_at, updated_at)
      values (
        v_org_b_id,
        v_student_id,
        v_batch_b_id,
        v_day,
        case when v_day in (4, 8) then 'rest' else 'done' end,
        now() - ((10 - v_day) || ' days')::interval,
        now() - ((10 - v_day) || ' days')::interval
      )
      on conflict (student_id, batch_id, day_number) do update set status = excluded.status;
    end loop;
  end loop;

  -- --------------------------------------------------------------------------
  -- 3.7 BATCH INVITES
  -- --------------------------------------------------------------------------
  insert into public.batch_invites (org_id, batch_id, email, claimed_by)
  values
    (v_org_a_id, v_batch_day23_id, 'pending.karen@example.com', null),
    (v_org_a_id, v_batch_day23_id, 'pending.raj@example.com', null),
    (v_org_a_id, v_batch_day23_id, 'pending.charlotte@example.com', null),
    (v_org_a_id, v_batch_day23_id, 'student01@example.com', 'd0000000-0000-0000-0000-000000000001'::uuid),
    (v_org_a_id, v_batch_day2_id,  'pending.elena@example.com', null),
    (v_org_a_id, v_batch_day2_id,  'pending.mateo@example.com', null),
    (v_org_a_id, v_batch_day1_id,  'invite.welcome@example.com', null)
  on conflict (batch_id, email) do nothing;

  -- --------------------------------------------------------------------------
  -- 3.8 CHECK-INS FOR AUTUMN AWAKENING (DAY 23 BATCH)
  -- 30 Students:
  --   Students 1-15: Dedicated high streakers (almost all 'done', occasional 'rest')
  --   Students 16-25: Intermittent practitioners ('done', 'not_yet', missed days)
  --   Students 26-30: 5 QUIET STUDENTS (No check-ins on Days 19, 20, 21, 22, 23!)
  -- --------------------------------------------------------------------------
  for v_student_idx in 1..30 loop
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(v_student_idx::text, 12, '0'))::uuid;

    -- CASE 1: Students 26 to 30 -> THE 5 QUIET STUDENTS
    -- They checked in up to Day 18, but have NO check-ins for days 19, 20, 21, 22, 23!
    -- (Per SPEC: "Quiet: no check-in of any kind for 4 consecutive days")
    if v_student_idx >= 26 then
      for v_day in 1..18 loop
        v_status := case when v_day % 5 = 0 then 'rest' else 'done' end;
        insert into public.checkins (org_id, student_id, batch_id, day_number, status, created_at, updated_at)
        values (
          v_org_a_id,
          v_student_id,
          v_batch_day23_id,
          v_day,
          v_status,
          (current_date - (23 - v_day))::timestamptz + time '08:00:00',
          (current_date - (23 - v_day))::timestamptz + time '08:00:00'
        )
        on conflict (student_id, batch_id, day_number) do update set status = excluded.status;
      end loop;
      -- Days 19, 20, 21, 22, 23 are completely skipped! Student is flagged Quiet!

    -- CASE 2: Students 1 to 15 -> High Streakers (Daily practice, high engagement)
    elsif v_student_idx <= 15 then
      for v_day in 1..22 loop
        -- Rest days neither add to nor break streak per SPEC
        v_status := case
          when v_day in (7, 14, 21) and v_student_idx % 2 = 0 then 'rest'
          else 'done'
        end;

        insert into public.checkins (org_id, student_id, batch_id, day_number, status, created_at, updated_at)
        values (
          v_org_a_id,
          v_student_id,
          v_batch_day23_id,
          v_day,
          v_status,
          (current_date - (23 - v_day))::timestamptz + time '07:15:00',
          (current_date - (23 - v_day))::timestamptz + time '07:15:00'
        )
        on conflict (student_id, batch_id, day_number) do update set status = excluded.status;
      end loop;

      -- Today (Day 23): Students 1-8 already checked in today!
      if v_student_idx <= 8 then
        insert into public.checkins (org_id, student_id, batch_id, day_number, status, created_at, updated_at)
        values (
          v_org_a_id,
          v_student_id,
          v_batch_day23_id,
          23,
          case when v_student_idx % 4 = 0 then 'rest' else 'done' end,
          current_date::timestamptz + time '07:45:00',
          current_date::timestamptz + time '07:45:00'
        )
        on conflict (student_id, batch_id, day_number) do update set status = excluded.status;
      end if;

    -- CASE 3: Students 16 to 25 -> Mixed & Moderate Practice
    else
      for v_day in 1..22 loop
        -- Skip random day to break streaks
        if (v_day + v_student_idx) % 6 <> 0 then
          v_status := case
            when (v_day + v_student_idx) % 4 = 0 then 'rest'
            when (v_day + v_student_idx) % 7 = 0 then 'not_yet'
            else 'done'
          end;

          insert into public.checkins (org_id, student_id, batch_id, day_number, status, created_at, updated_at)
          values (
            v_org_a_id,
            v_student_id,
            v_batch_day23_id,
            v_day,
            v_status,
            (current_date - (23 - v_day))::timestamptz + time '09:30:00',
            (current_date - (23 - v_day))::timestamptz + time '09:30:00'
          )
          on conflict (student_id, batch_id, day_number) do update set status = excluded.status;
        end if;
      end loop;

      -- Checkin for day 22 so they are NOT quiet
      insert into public.checkins (org_id, student_id, batch_id, day_number, status, created_at, updated_at)
      values (
        v_org_a_id,
        v_student_id,
        v_batch_day23_id,
        22,
        'done',
        (current_date - 1)::timestamptz + time '08:30:00',
        (current_date - 1)::timestamptz + time '08:30:00'
      )
      on conflict (student_id, batch_id, day_number) do update set status = excluded.status;
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- 3.9 CHECK-INS FOR SUMMER SOLSTICE (FINISHED DAY 40 BATCH)
  -- --------------------------------------------------------------------------
  for v_student_idx in 1..15 loop
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(v_student_idx::text, 12, '0'))::uuid;
    for v_day in 1..40 loop
      if (v_day + v_student_idx) % 11 <> 0 then
        insert into public.checkins (org_id, student_id, batch_id, day_number, status, created_at, updated_at)
        values (
          v_org_a_id,
          v_student_id,
          v_batch_day40_id,
          v_day,
          case when v_day in (7, 14, 21, 28, 35) then 'rest' else 'done' end,
          (current_date - (40 - v_day))::timestamptz + time '06:45:00',
          (current_date - (40 - v_day))::timestamptz + time '06:45:00'
        )
        on conflict (student_id, batch_id, day_number) do update set status = excluded.status;
      end if;
    end loop;
  end loop;

  -- --------------------------------------------------------------------------
  -- 3.10 LESSONS (General, Course, and Batch Scope)
  -- --------------------------------------------------------------------------
  -- General Lesson 1
  insert into public.lessons (org_id, title, body, scope, published, author_id)
  values (
    v_org_a_id,
    'Introduction to Sadhana: Cultivating Daily Stillness',
    '### The Spirit of Daily Practice

Sadhana is not a chore to complete; it is a sacred meeting with your inner self. When you sit each morning, you create a sanctuary of conscious stillness before the world demands your attention.

**Three Core Principles:**
1. **Consistency over intensity:** 15 minutes every single day reshapes the neural pathways more effectively than two hours once a week.
2. **Posture with dignity:** Keep your spine tall, shoulders relaxed, and palms resting gently on your knees.
3. **Breath as the anchor:** Whenever your attention wanders into plans or memories, softly return to the sensation of breath at the tip of the nose.',
    'general',
    true,
    v_teacher_a1_id
  )
  on conflict do nothing;

  -- General Lesson 2
  insert into public.lessons (org_id, title, body, scope, published, author_id)
  values (
    v_org_a_id,
    'Breath as an Anchor: The 4-7-8 Centering Practice',
    '### Soothing the Nervous System

When the mind feels racing or agitated, physical breathing rhythms quickly signal safety to the autonomic nervous system.

- **Inhale quietly through your nose** for a count of 4.
- **Hold your breath** gently without tension for a count of 7.
- **Exhale completely through your mouth** with a soft whoosh for a count of 8.

Repeat this cycle four times prior to commencing your meditation.',
    'general',
    true,
    v_teacher_a1_id
  )
  on conflict do nothing;

  -- Course Lesson
  insert into public.lessons (org_id, title, body, scope, course_id, published, author_id)
  values (
    v_org_a_id,
    'The 40-Day Sacred Commitment: Transforming Routine into Ritual',
    '### Why 40 Days?

In ancient contemplative traditions and modern neuroscience alike, 40 consecutive days represents the psychological threshold where deliberate effort crystallizes into identity. 

- **Days 1–10 (Resistance):** The mind challenges the new rhythm. You may feel restlessness or doubt.
- **Days 11–25 (Integration):** The rhythm stabilizes. Quietness begins to feel familiar.
- **Days 26–40 (Embodiment):** Sitting is no longer what you *do*; stillness is who you *are*.',
    'course',
    v_course_a1_id,
    true,
    v_teacher_a1_id
  )
  on conflict do nothing;

  -- Batch Daily Lessons
  insert into public.lessons (org_id, title, body, scope, batch_id, day_number, published, author_id)
  values (
    v_org_a_id,
    'Day 1: Sankalpa — The Sacred Seed of Intention',
    'Today is Day 1 of our cohort journey together. Set your Sankalpa — a positive, heartfelt declaration of truth spoken in the present tense: *"I am grounded, aware, and open to stillness."*',
    'batch',
    v_batch_day23_id,
    1,
    true,
    v_teacher_a1_id
  )
  on conflict do nothing;

  insert into public.lessons (org_id, title, body, scope, batch_id, day_number, published, author_id)
  values (
    v_org_a_id,
    'Day 7: The First Milestone — Honoring Consistency',
    'One full week completed! You have shown up through distractions and busy schedules. Take a moment to honor your dedication and the collective field of our cohort.',
    'batch',
    v_batch_day23_id,
    7,
    true,
    v_teacher_a1_id
  )
  on conflict do nothing;

  insert into public.lessons (org_id, title, body, scope, batch_id, day_number, published, author_id)
  values (
    v_org_a_id,
    'Day 21: The Halfway Threshold — Flow and Surrender',
    'Reaching Day 21 marks a pivotal deepening. Notice how less effort is required to settle the body. Trust the silence.',
    'batch',
    v_batch_day23_id,
    21,
    true,
    v_teacher_a1_id
  )
  on conflict do nothing;

  -- Org B Lesson
  insert into public.lessons (org_id, title, body, scope, published, author_id)
  values (
    v_org_b_id,
    'Pranayama Foundations: Directing Vital Life Force',
    'Breath is the vehicle of consciousness. Learn the fundamentals of diaphragmatic breathing and nadi shodhana.',
    'general',
    true,
    v_teacher_b_id
  )
  on conflict do nothing;

end;
$$;
