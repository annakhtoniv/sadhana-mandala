-- Sadhana Mandala: Database Schema & Access Rules
-- Compatible with Supabase Postgres

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. ORGANISATIONS
-- ============================================================================
create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  app_name text not null,
  logo_url text,
  primary_colour text not null default '#1c1917',
  accent_colour text not null default '#059669',
  support_email text,
  checkin_question text not null default 'Did you complete your daily practice today?',
  footer_text text,
  timezone text not null default 'Asia/Dubai',
  show_powered_by boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 2. PROFILES (extends Supabase auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 3. ROLE GRANTS (pre-assign role by email before sign in)
-- ============================================================================
create table if not exists public.role_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now(),
  unique(org_id, email)
);

-- ============================================================================
-- 4. SECURITY DEFINER HELPER FUNCTIONS (avoid policy recursion)
-- ============================================================================
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

-- Protect critical profile fields (users cannot change their own role or org)
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if new.role <> old.role and coalesce((select public.get_current_user_role()), '') <> 'admin' then
    raise exception 'Cannot change role directly';
  end if;
  if new.org_id <> old.org_id then
    raise exception 'Cannot change organisation';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_protect_profile_fields on public.profiles;
create trigger tr_protect_profile_fields
before update on public.profiles
for each row execute function public.protect_profile_fields();

-- ============================================================================
-- 5. AUTOMATIC PROFILE CREATION ON AUTH SIGN-IN
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text := 'student';
  v_org_slug text;
begin
  -- Resolve org slug from user metadata (if set) or fallback to 'sadhana-mandala'
  v_org_slug := coalesce(new.raw_user_meta_data->>'org_slug', 'sadhana-mandala');

  -- Locate organisation
  select id into v_org_id from public.organisations where slug = v_org_slug limit 1;

  if v_org_id is null then
    select id into v_org_id from public.organisations order by created_at asc limit 1;
  end if;

  -- Check if email was pre-granted a role in role_grants
  if v_org_id is not null and new.email is not null then
    select role into v_role 
    from public.role_grants 
    where org_id = v_org_id and lower(email) = lower(new.email)
    limit 1;
  end if;

  if v_role is null then
    v_role := 'student';
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 6. ACCOUNT DELETION FUNCTION (removes user account and cascaded data)
-- ============================================================================
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.role_grants enable row level security;

-- Organisations: public can read branding info by slug; Admins can update
drop policy if exists "Anyone can read organisations" on public.organisations;
create policy "Anyone can read organisations"
  on public.organisations for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can update own organisation" on public.organisations;
create policy "Admins can update own organisation"
  on public.organisations for update
  to authenticated
  using (id = public.get_current_user_org_id() and public.get_current_user_role() = 'admin')
  with check (id = public.get_current_user_org_id() and public.get_current_user_role() = 'admin');

-- Profiles: Users can read own profile; Admins read org profiles
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Admins can read all org profiles" on public.profiles;
create policy "Admins can read all org profiles"
  on public.profiles for select
  to authenticated
  using (org_id = public.get_current_user_org_id() and public.get_current_user_role() = 'admin');

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Role grants: Read/manage only by Admins inside their own organisation
drop policy if exists "Admins can manage role grants" on public.role_grants;
create policy "Admins can manage role grants"
  on public.role_grants for all
  to authenticated
  using (org_id = public.get_current_user_org_id() and public.get_current_user_role() = 'admin')
  with check (org_id = public.get_current_user_org_id() and public.get_current_user_role() = 'admin');

-- ============================================================================
-- 8. DEFAULT SEED DATA (Organisation A: Sadhana Mandala)
-- ============================================================================
insert into public.organisations (
  name,
  slug,
  app_name,
  primary_colour,
  accent_colour,
  support_email,
  checkin_question,
  footer_text,
  timezone,
  show_powered_by
) values (
  'Sadhana Mandala',
  'sadhana-mandala',
  'Sadhana Mandala',
  '#1c1917',
  '#059669',
  'support@zyxenai.com',
  'Did you complete your daily practice today?',
  'Mindful daily practice and teacher guidance',
  'Asia/Dubai',
  true
)
on conflict (slug) do nothing;

-- ============================================================================
-- 9. BACKFILL EXISTING AUTH USERS (for users who already signed in)
-- ============================================================================
insert into public.profiles (id, org_id, email, full_name, role)
select 
  u.id, 
  o.id as org_id, 
  coalesce(u.email, ''), 
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
  coalesce((select rg.role from public.role_grants rg where rg.org_id = o.id and lower(rg.email) = lower(u.email) limit 1), 'student') as role
from auth.users u
cross join (select id from public.organisations where slug = 'sadhana-mandala' limit 1) o
on conflict (id) do update set
  email = excluded.email,
  full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);
