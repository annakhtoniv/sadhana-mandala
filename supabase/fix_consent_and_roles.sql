-- Fix Consent Persistence and Create Admin / Teacher Accounts
-- Run this in your Supabase SQL Editor

-- 1. Ensure INSERT and UPDATE policies on public.profiles
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 2. Security-definer RPC function to permanently save user consent
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

  -- Update profile consent_at
  update public.profiles
  set consent_at = v_now, updated_at = v_now
  where id = auth.uid();

  -- If profile row was somehow missing, create it now with consent
  if not found then
    insert into public.profiles (id, org_id, email, role, consent_at)
    values (auth.uid(), v_org_id, v_email, 'admin', v_now)
    on conflict (id) do update set consent_at = v_now;
  end if;

  return v_now;
end;
$$;

-- 3. Upgrade your current account to ADMIN in both profiles and role_grants
update public.profiles
set role = 'admin', consent_at = coalesce(consent_at, now());

insert into public.role_grants (org_id, email, role)
select org_id, lower(email), 'admin'
from public.profiles
on conflict (org_id, email) do update set role = 'admin';

-- 4. Create Teacher and Admin demo profiles (without real email addresses)
do $$
declare
  v_org_id uuid;
  v_course_id uuid;
  v_teacher_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_admin_id uuid := 'a0000000-0000-0000-0000-000000000002';
begin
  select id into v_org_id from public.organisations where slug = 'sadhana-mandala' limit 1;
  if v_org_id is null then return; end if;

  -- Demo Teacher
  insert into public.profiles (id, org_id, email, full_name, role, consent_at)
  values (
    v_teacher_id,
    v_org_id,
    'teacher@demo.local',
    'Ananda Sharma (Teacher)',
    'teacher',
    now()
  )
  on conflict (id) do update set role = 'teacher';

  insert into public.role_grants (org_id, email, role)
  values (v_org_id, 'teacher@demo.local', 'teacher')
  on conflict (org_id, email) do update set role = 'teacher';

  -- Demo Admin
  insert into public.profiles (id, org_id, email, full_name, role, consent_at)
  values (
    v_admin_id,
    v_org_id,
    'admin@demo.local',
    'Sadhana Admin',
    'admin',
    now()
  )
  on conflict (id) do update set role = 'admin';

  insert into public.role_grants (org_id, email, role)
  values (v_org_id, 'admin@demo.local', 'admin')
  on conflict (org_id, email) do update set role = 'admin';

  -- Ensure sample Course exists
  insert into public.courses (org_id, name, description, duration_days)
  values (
    v_org_id,
    '40-Day Sadhana Practice',
    'A transformative daily meditation and awareness commitment for forty days.',
    40
  )
  on conflict do nothing;

  select id into v_course_id from public.courses where org_id = v_org_id limit 1;

  -- Create a sample Demo Batch owned by the teacher
  if v_course_id is not null then
    insert into public.batches (org_id, course_id, teacher_id, name, start_date, join_code)
    values (
      v_org_id,
      v_course_id,
      v_teacher_id,
      'October Sadhana Batch',
      current_date,
      'SADH40'
    )
    on conflict (org_id, join_code) do nothing;
  end if;
end;
$$;
