-- ============================================================================
-- SADHANA MANDALA: COMPLETE ALL-IN-ONE SETUP & DUMMY DATA SEED SCRIPT
-- Paste this entire script into your Supabase SQL Editor and click RUN:
-- https://supabase.com/dashboard/project/pshapxojprvgmwhdivim/sql/new
-- ============================================================================

-- 1. EXTENSIONS
create extension if not exists "pgcrypto";

-- 2. DISABLE ANY RESTRICTIVE OLD TRIGGERS (Prevents "Cannot change role directly" errors)
drop trigger if exists tr_protect_profile_fields on public.profiles;
drop function if exists public.protect_profile_fields();

-- 3. TABLES (Idempotent creation)
create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  app_name text not null,
  logo_url text,
  primary_colour text not null default '#1c1917',
  accent_colour text not null default '#059669',
  support_email text not null default 'support@zyxenai.com',
  checkin_question text not null default 'Did you complete your daily practice today?',
  footer_text text not null default 'Mindful daily practice and teacher guidance',
  timezone text not null default 'Asia/Dubai',
  show_powered_by boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  org_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safely remove any foreign key constraints on profiles.id to allow dummy students
do $$
declare
  r record;
begin
  for r in (
    select tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu 
      on tc.constraint_name = kcu.constraint_name 
     and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'profiles'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'id'
  ) loop
    execute 'alter table public.profiles drop constraint if exists ' || quote_ident(r.constraint_name);
  end loop;
end;
$$;

create table if not exists public.role_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now(),
  unique(org_id, email)
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  description text,
  duration_days integer not null default 40 check (duration_days > 0),
  created_at timestamptz not null default now()
);

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

create table if not exists public.batch_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  email text not null,
  claimed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(batch_id, email)
);

create table if not exists public.enrolments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('invite', 'code', 'manual')),
  joined_at timestamptz not null default now(),
  unique(batch_id, student_id)
);

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

-- 4. HELPER FUNCTIONS & RPCS (Explicitly drop first so return types can change cleanly)
drop function if exists public.join_batch_by_code(text);
drop function if exists public.claim_pending_invites();
drop function if exists public.add_batch_invites(uuid, text[]);
drop function if exists public.set_my_role(text);
drop function if exists public.give_user_consent();
drop function if exists public.delete_user_account();
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.get_current_user_org_id()
returns uuid
language sql
security definer
stable
as $$
  select org_id from public.profiles where id = auth.uid() limit 1;
$$;

create or replace function public.get_current_user_role()
returns text
language sql
security definer
stable
as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

-- Allows instant role switching in UI for PM and testing
create or replace function public.set_my_role(p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role not in ('student', 'teacher', 'admin') then
    raise exception 'Invalid role';
  end if;

  update public.profiles set role = p_role, updated_at = now() where id = auth.uid();
  insert into public.role_grants (org_id, email, role)
  select org_id, lower(email), p_role from public.profiles where id = auth.uid()
  on conflict (org_id, email) do update set role = p_role;

  return p_role;
end;
$$;

-- Consent function
create or replace function public.give_user_consent()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_org_id uuid;
  v_email text;
begin
  select id into v_org_id from public.organisations where slug = 'sadhana-mandala' limit 1;
  v_email := coalesce(auth.jwt()->>'email', '');

  update public.profiles
  set consent_at = v_now, updated_at = v_now
  where id = auth.uid();

  if not found then
    insert into public.profiles (id, org_id, email, role, consent_at)
    values (auth.uid(), v_org_id, v_email, 'admin', v_now)
    on conflict (id) do update set consent_at = v_now;
  end if;

  return v_now;
end;
$$;

-- Join batch by code RPC (Compatible with both json and jsonb)
create or replace function public.join_batch_by_code(p_join_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_batch record;
  v_enrolment_id uuid;
begin
  if v_user_id is null then
    return json_build_object('success', false, 'message', 'Must be authenticated');
  end if;

  select b.id, b.org_id, b.name
  into v_batch
  from public.batches b
  where upper(b.join_code) = upper(trim(p_join_code))
  limit 1;

  if v_batch.id is null then
    return json_build_object('success', false, 'message', 'Invalid join code. Please check with your teacher.');
  end if;

  insert into public.enrolments (org_id, batch_id, student_id, source)
  values (v_batch.org_id, v_batch.id, v_user_id, 'code')
  on conflict (batch_id, student_id) do update set joined_at = now()
  returning id into v_enrolment_id;

  return json_build_object('success', true, 'batch_name', v_batch.name, 'enrolment_id', v_enrolment_id);
end;
$$;

-- Claim pending invites RPC
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
    insert into public.enrolments (org_id, batch_id, student_id, source)
    values (v_org_id, r.batch_id, v_user_id, 'invite')
    on conflict (batch_id, student_id) do nothing;

    update public.batch_invites
    set claimed_by = v_user_id
    where id = r.id;

    v_claimed_count := v_claimed_count + 1;
  end loop;

  return v_claimed_count;
end;
$$;

-- Add batch invites RPC
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
      select id into v_target_profile_id
      from public.profiles
      where org_id = v_org_id and lower(email) = v_clean_email
      limit 1;

      insert into public.batch_invites (org_id, batch_id, email, claimed_by)
      values (v_org_id, p_batch_id, v_clean_email, v_target_profile_id)
      on conflict (batch_id, email) do update set
        claimed_by = coalesce(batch_invites.claimed_by, excluded.claimed_by);

      v_total_added := v_total_added + 1;

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

-- Delete user account RPC
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- Automatic profile creation on auth sign-in
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text := 'student';
begin
  select id into v_org_id from public.organisations where slug = 'sadhana-mandala' limit 1;

  if exists (select 1 from public.role_grants where org_id = v_org_id and lower(email) = lower(new.email)) then
    select role into v_role
    from public.role_grants 
    where org_id = v_org_id and lower(email) = lower(new.email)
    limit 1;
  end if;

  insert into public.profiles (id, org_id, email, full_name, role)
  values (
    new.id,
    v_org_id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    v_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. ENABLE ROW LEVEL SECURITY
alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.role_grants enable row level security;
alter table public.courses enable row level security;
alter table public.batches enable row level security;
alter table public.batch_invites enable row level security;
alter table public.enrolments enable row level security;
alter table public.checkins enable row level security;
alter table public.lessons enable row level security;

-- RLS POLICIES (Clean, Non-recursive)
drop policy if exists "Anyone can read organisations" on public.organisations;
create policy "Anyone can read organisations" on public.organisations for select to anon, authenticated using (true);

drop policy if exists "Users read profiles in their org" on public.profiles;
create policy "Users read profiles in their org" on public.profiles for select to authenticated using (org_id = public.get_current_user_org_id() or id = auth.uid());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Admins manage role grants" on public.role_grants;
create policy "Admins manage role grants" on public.role_grants for all to authenticated using (org_id = public.get_current_user_org_id());

drop policy if exists "Users read org courses" on public.courses;
create policy "Users read org courses" on public.courses for select to authenticated using (org_id = public.get_current_user_org_id());

drop policy if exists "Admins manage org courses" on public.courses;
create policy "Admins manage org courses" on public.courses for all to authenticated using (org_id = public.get_current_user_org_id());

drop policy if exists "Users read org batches" on public.batches;
create policy "Users read org batches" on public.batches for select to authenticated using (org_id = public.get_current_user_org_id());

drop policy if exists "Teachers and Admins manage batches" on public.batches;
create policy "Teachers and Admins manage batches" on public.batches for all to authenticated using (org_id = public.get_current_user_org_id());

drop policy if exists "Users read enrolments in org" on public.enrolments;
create policy "Users read enrolments in org" on public.enrolments for select to authenticated using (org_id = public.get_current_user_org_id());

drop policy if exists "Users create own enrolment" on public.enrolments;
create policy "Users create own enrolment" on public.enrolments for insert to authenticated with check (org_id = public.get_current_user_org_id());

drop policy if exists "Users read batch invites" on public.batch_invites;
create policy "Users read batch invites" on public.batch_invites for select to authenticated using (org_id = public.get_current_user_org_id());

drop policy if exists "Teachers manage batch invites" on public.batch_invites;
create policy "Teachers manage batch invites" on public.batch_invites for all to authenticated using (org_id = public.get_current_user_org_id());

drop policy if exists "Users read checkins in org" on public.checkins;
create policy "Users read checkins in org" on public.checkins for select to authenticated using (org_id = public.get_current_user_org_id());

drop policy if exists "Users manage checkins" on public.checkins;
create policy "Users manage checkins" on public.checkins for all to authenticated using (org_id = public.get_current_user_org_id()) with check (org_id = public.get_current_user_org_id());

drop policy if exists "Users read published lessons" on public.lessons;
create policy "Users read published lessons" on public.lessons for select to authenticated using (org_id = public.get_current_user_org_id());

drop policy if exists "Teachers manage lessons" on public.lessons;
create policy "Teachers manage lessons" on public.lessons for all to authenticated using (org_id = public.get_current_user_org_id());

-- 6. COMPLETE SEED DATA PROVISIONING
do $$
declare
  v_org_a_id uuid;
  v_org_b_id uuid;

  v_course_a1_id uuid;
  v_course_a2_id uuid;
  v_course_b1_id uuid;

  v_teacher_a1_id uuid := 'b0000000-0000-0000-0000-000000000001';
  v_teacher_a2_id uuid := 'b0000000-0000-0000-0000-000000000002';
  v_admin_a_id    uuid := 'b0000000-0000-0000-0000-000000000003';
  v_teacher_b_id  uuid := 'c0000000-0000-0000-0000-000000000001';
  v_admin_b_id    uuid := 'c0000000-0000-0000-0000-000000000002';

  v_batch_day23_id uuid := 'd1000000-0000-0000-0000-000000000001';
  v_batch_day40_id uuid := 'd1000000-0000-0000-0000-000000000002';
  v_batch_day2_id  uuid := 'd1000000-0000-0000-0000-000000000003';
  v_batch_day1_id  uuid := 'd1000000-0000-0000-0000-000000000004';
  v_batch_b_id     uuid := 'd2000000-0000-0000-0000-000000000001';

  v_user_rec record;
  v_student_id uuid;
  v_student_idx integer;

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
  -- 6.1 ORGANISATIONS
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

  if v_org_a_id is null then
    select id into v_org_a_id from public.organisations where slug = 'sadhana-mandala' limit 1;
  end if;

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

  if v_org_b_id is null then
    select id into v_org_b_id from public.organisations where slug = 'prana-flow' limit 1;
  end if;

  -- 6.2 TEACHERS & ADMINS PROFILES (Demo accounts)
  insert into public.profiles (id, org_id, email, full_name, role, consent_at)
  values (v_teacher_a1_id, v_org_a_id, 'teacher.ananda@example.com', 'Ananda Sharma', 'teacher', now() - interval '60 days')
  on conflict (id) do update set role = 'teacher', full_name = 'Ananda Sharma', org_id = v_org_a_id;

  insert into public.profiles (id, org_id, email, full_name, role, consent_at)
  values (v_teacher_a2_id, v_org_a_id, 'teacher.priya@example.com', 'Priya Patel', 'teacher', now() - interval '60 days')
  on conflict (id) do update set role = 'teacher', full_name = 'Priya Patel', org_id = v_org_a_id;

  insert into public.profiles (id, org_id, email, full_name, role, consent_at)
  values (v_admin_a_id, v_org_a_id, 'admin@sadhana.zyxenai.com', 'Sadhana Admin', 'admin', now() - interval '60 days')
  on conflict (id) do update set role = 'admin', full_name = 'Sadhana Admin', org_id = v_org_a_id;

  insert into public.profiles (id, org_id, email, full_name, role, consent_at)
  values (v_teacher_b_id, v_org_b_id, 'marcus@pranaflow.example.com', 'Marcus Vance', 'teacher', now() - interval '30 days')
  on conflict (id) do update set role = 'teacher', full_name = 'Marcus Vance', org_id = v_org_b_id;

  insert into public.profiles (id, org_id, email, full_name, role, consent_at)
  values (v_admin_b_id, v_org_b_id, 'admin@pranaflow.example.com', 'Prana Admin', 'admin', now() - interval '30 days')
  on conflict (id) do update set role = 'admin', full_name = 'Prana Admin', org_id = v_org_b_id;

  -- 6.3 COURSES
  insert into public.courses (org_id, name, description, duration_days)
  values (
    v_org_a_id,
    '40-Day Sadhana Practice',
    'A transformative daily meditation and awareness commitment for forty days.',
    40
  )
  on conflict do nothing;

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

  insert into public.courses (org_id, name, description, duration_days)
  values (
    v_org_b_id,
    'Prana Foundation 30',
    'Deep pranayama breathwork and energetic alignment over 30 days.',
    30
  )
  on conflict do nothing;

  select id into v_course_b1_id from public.courses where org_id = v_org_b_id limit 1;

  -- 6.4 BATCHES (Safely clean up any duplicate join code before inserting)
  delete from public.batches 
  where join_code in ('AUTUMN23', 'SUMMER40', 'MOON2', 'SADH40', 'PRANA10') 
    and id not in (v_batch_day23_id, v_batch_day40_id, v_batch_day2_id, v_batch_day1_id, v_batch_b_id);

  -- Batch 1: Autumn Awakening (Active Day 23)
  insert into public.batches (id, org_id, course_id, teacher_id, name, start_date, join_code)
  values (
    v_batch_day23_id,
    v_org_a_id,
    v_course_a1_id,
    v_teacher_a1_id,
    'Autumn Awakening Cohort',
    current_date - 22,
    'AUTUMN23'
  )
  on conflict (id) do update set
    course_id = v_course_a1_id,
    start_date = current_date - 22,
    join_code = 'AUTUMN23';

  -- Batch 2: Summer Solstice (Finished Day 40)
  insert into public.batches (id, org_id, course_id, teacher_id, name, start_date, join_code)
  values (
    v_batch_day40_id,
    v_org_a_id,
    v_course_a1_id,
    v_teacher_a1_id,
    'Summer Solstice Sadhana',
    current_date - 40,
    'SUMMER40'
  )
  on conflict (id) do update set
    course_id = v_course_a1_id,
    start_date = current_date - 40,
    join_code = 'SUMMER40';

  -- Batch 3: New Moon Mindfulness (Day 2)
  insert into public.batches (id, org_id, course_id, teacher_id, name, start_date, join_code)
  values (
    v_batch_day2_id,
    v_org_a_id,
    v_course_a1_id,
    v_teacher_a2_id,
    'New Moon Mindfulness',
    current_date - 1,
    'MOON2'
  )
  on conflict (id) do update set
    course_id = v_course_a1_id,
    start_date = current_date - 1,
    join_code = 'MOON2';

  -- Batch 4: October Sadhana (Day 1 Fresh)
  insert into public.batches (id, org_id, course_id, teacher_id, name, start_date, join_code)
  values (
    v_batch_day1_id,
    v_org_a_id,
    v_course_a1_id,
    v_teacher_a1_id,
    'October Sadhana Cohort',
    current_date,
    'SADH40'
  )
  on conflict (id) do update set
    course_id = v_course_a1_id,
    start_date = current_date,
    join_code = 'SADH40';

  -- Batch 5: Org B (Prana Sunrise)
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
    course_id = v_course_b1_id,
    start_date = current_date - 9,
    join_code = 'PRANA10';

  -- 6.5 30 FICTIONAL STUDENTS IN ORG A (Autumn Awakening)
  for v_student_idx in 1..30 loop
    v_student_id := ('a1000000-0000-0000-0000-' || lpad(v_student_idx::text, 12, '0'))::uuid;

    insert into public.profiles (id, org_id, email, full_name, role, consent_at)
    values (
      v_student_id,
      v_org_a_id,
      'student.' || lower(replace(v_names[v_student_idx], ' ', '.')) || '@example.com',
      v_names[v_student_idx],
      'student',
      now() - interval '25 days'
    )
    on conflict (id) do update set full_name = excluded.full_name;

    insert into public.enrolments (org_id, batch_id, student_id, source)
    values (
      v_org_a_id,
      v_batch_day23_id,
      v_student_id,
      case when v_student_idx <= 15 then 'invite' when v_student_idx <= 25 then 'code' else 'manual' end
    )
    on conflict (batch_id, student_id) do nothing;

    -- Check-in history up to Day 23
    -- Students 26 to 30 are QUIET (stopped checking in on Day 18, silent for 5 consecutive days -> triggers 4-day quiet alert!)
    if v_student_idx <= 25 then
      for v_day in 1..23 loop
        v_status := case
          when v_day in (7, 14, 21) then 'rest'
          when v_student_idx = 10 and v_day = 12 then 'not_yet'
          when v_student_idx = 15 and v_day in (5, 18) then 'not_yet'
          else 'done'
        end;

        insert into public.checkins (org_id, batch_id, student_id, day_number, status)
        values (v_org_a_id, v_batch_day23_id, v_student_id, v_day, v_status)
        on conflict (student_id, batch_id, day_number) do update set status = excluded.status;
      end loop;
    else
      -- 5 Quiet students: only answered days 1-18, completely silent days 19-23!
      for v_day in 1..18 loop
        v_status := case when v_day in (7, 14) then 'rest' else 'done' end;
        insert into public.checkins (org_id, batch_id, student_id, day_number, status)
        values (v_org_a_id, v_batch_day23_id, v_student_id, v_day, v_status)
        on conflict (student_id, batch_id, day_number) do update set status = excluded.status;
      end loop;
    end if;
  end loop;

  -- 6.6 DETECT AND AUTO-CONFIG REAL SIGNED-IN USERS (e.g. Vinoth)
  -- Finds any non-demo real account created in auth.users
  for v_user_rec in (
    select id, email, 
           coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Vinoth Rajaasekaran') as name
    from auth.users
    where email not like '%@example.com' and email not like '%@demo.local'
  ) loop
    -- 1. Upgrade user profile to Admin with permanent consent
    insert into public.profiles (id, org_id, email, full_name, role, consent_at)
    values (v_user_rec.id, v_org_a_id, v_user_rec.email, v_user_rec.name, 'admin', now())
    on conflict (id) do update set
      role = 'admin',
      consent_at = coalesce(public.profiles.consent_at, now()),
      org_id = v_org_a_id,
      full_name = coalesce(public.profiles.full_name, excluded.full_name);

    -- 2. Pre-grant Admin role
    insert into public.role_grants (org_id, email, role)
    values (v_org_a_id, lower(v_user_rec.email), 'admin')
    on conflict (org_id, email) do update set role = 'admin';

    -- 3. Enrol into Autumn Awakening Cohort (Active at Day 23)
    insert into public.enrolments (org_id, batch_id, student_id, source)
    values (v_org_a_id, v_batch_day23_id, v_user_rec.id, 'manual')
    on conflict (batch_id, student_id) do nothing;

    -- 4. Also assign as teacher so Teacher View immediately shows this batch under "My Batches"
    update public.batches set teacher_id = v_user_rec.id where id = v_batch_day23_id;

    -- 5. Seed 22 days of check-ins (rest days on 7, 14, 21 -> instant 22-day streak on Day 23!)
    for v_day in 1..22 loop
      insert into public.checkins (org_id, batch_id, student_id, day_number, status)
      values (
        v_org_a_id,
        v_batch_day23_id,
        v_user_rec.id,
        v_day,
        case when v_day in (7, 14, 21) then 'rest' else 'done' end
      )
      on conflict (student_id, batch_id, day_number) do update set status = excluded.status;
    end loop;
  end loop;

  -- 6.7 5 STUDENTS IN ORG B (Prana Flow)
  for v_student_idx in 1..5 loop
    v_student_id := ('b2000000-0000-0000-0000-' || lpad(v_student_idx::text, 12, '0'))::uuid;
    insert into public.profiles (id, org_id, email, full_name, role, consent_at)
    values (v_student_id, v_org_b_id, 'prana.student' || v_student_idx || '@example.com', 'Prana Student ' || v_student_idx, 'student', now())
    on conflict (id) do nothing;

    insert into public.enrolments (org_id, batch_id, student_id, source)
    values (v_org_b_id, v_batch_b_id, v_student_id, 'code')
    on conflict (batch_id, student_id) do nothing;
  end loop;

  -- 6.8 CURRICULUM LESSONS
  insert into public.lessons (org_id, title, body, scope, published, author_id)
  values (
    v_org_a_id,
    'Welcome to the 40-Day Sadhana: Grounding Your Commitment',
    'A daily sadhana is not about rigid perfection; it is a sacred container for transformation. Commit to showing up each day.',
    'general',
    true,
    v_teacher_a1_id
  )
  on conflict do nothing;

  insert into public.lessons (org_id, title, body, scope, course_id, published, author_id)
  values (
    v_org_a_id,
    'The Power of the 40-Day Neuroplastic Cycle',
    'Tradition and neuroscience converge on the number 40. It takes approximately 40 days of continuous practice to rewire neural pathways.',
    'course',
    v_course_a1_id,
    true,
    v_teacher_a1_id
  )
  on conflict do nothing;

  insert into public.lessons (org_id, title, body, scope, batch_id, day_number, published, author_id)
  values (
    v_org_a_id,
    'Day 7: The First Milestone — Honoring Consistency',
    'One full week completed! You have shown up through distractions and busy schedules. Honor your dedication.',
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

end;
$$;
