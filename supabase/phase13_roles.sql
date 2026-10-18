-- ============================================================================
-- Sadhana Mandala: Phase 13 migration (several roles per person)
--
-- PM request 2026-10-18: one person may be a student, a teacher, a volunteer
-- and an admin at the same time.
--   - profiles.roles and role_grants.roles: the list of roles (at least one).
--   - profiles.role and role_grants.role stay, and always hold the highest
--     role in the list (admin > teacher > volunteer > student). Every existing
--     access rule reads that column, so all rules keep working unchanged and
--     a person gets everything their highest role allows.
--   - Old code or scripts that still set only "role" keep working: the list
--     becomes that one role.
--   - Only an admin of the organisation changes roles. Admins may change
--     their own roles too, but cannot remove their own admin role (so the
--     organisation never locks itself out).
--   - A person who signs in for the first time gets all roles waiting for
--     their email in role_grants.
--
-- Adds columns, functions and triggers; nothing is dropped. Safe to run more
-- than once. Run after supabase/phase12_media.sql, then seed_dummy_data.sql,
-- then verify.sql.
-- ============================================================================

alter table public.profiles add column if not exists roles text[];
alter table public.role_grants add column if not exists roles text[];

-- Known roles only, no repeats, in a fixed order; never empty
create or replace function public.normalise_roles(p_roles text[])
returns text[] language sql immutable set search_path = public as $$
  select coalesce(
    (select array_agg(r order by array_position(array['student', 'volunteer', 'teacher', 'admin'], r))
     from (select distinct r from unnest(p_roles) as r
           where r in ('student', 'volunteer', 'teacher', 'admin')) x),
    array['student']);
$$;

-- The highest role in a list
create or replace function public.primary_role(p_roles text[])
returns text language sql immutable set search_path = public as $$
  select case
    when 'admin' = any(p_roles) then 'admin'
    when 'teacher' = any(p_roles) then 'teacher'
    when 'volunteer' = any(p_roles) then 'volunteer'
    else 'student'
  end;
$$;

-- Keeps roles and role in step (used on profiles and role_grants)
create or replace function public.sync_roles()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.roles is null or cardinality(new.roles) = 0 then
      new.roles := array[coalesce(new.role, 'student')];
    end if;
  elsif new.roles is not distinct from old.roles and new.role is distinct from old.role then
    -- Only the single role was changed (older code): the list becomes that role
    new.roles := array[new.role];
  end if;
  new.roles := public.normalise_roles(new.roles);
  new.role := public.primary_role(new.roles);
  return new;
end;
$$;

-- Existing people and invitations: the list starts as their current role
update public.profiles set roles = array[role] where roles is null;
update public.role_grants set roles = array[role] where roles is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_roles_check') then
    alter table public.profiles add constraint profiles_roles_check check (
      cardinality(roles) >= 1 and roles <@ array['student', 'volunteer', 'teacher', 'admin']);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'role_grants_roles_check') then
    alter table public.role_grants add constraint role_grants_roles_check check (
      cardinality(roles) >= 1 and roles <@ array['student', 'volunteer', 'teacher', 'admin']);
  end if;
  -- Named so it runs before the other "before" triggers on profiles
  if not exists (select 1 from pg_trigger where tgname = 'tr_a_sync_roles' and tgrelid = 'public.profiles'::regclass) then
    create trigger tr_a_sync_roles before insert or update on public.profiles
      for each row execute function public.sync_roles();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tr_a_sync_roles' and tgrelid = 'public.role_grants'::regclass) then
    create trigger tr_a_sync_roles before insert or update on public.role_grants
      for each row execute function public.sync_roles();
  end if;
end $$;

alter table public.profiles alter column roles set not null;
alter table public.role_grants alter column roles set not null;

-- Admins change roles through the "roles" column
grant update (roles) on public.profiles to authenticated;

-- Same protection as before, now for the list of roles
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only client sessions are restricted; SQL editor and seed scripts run without auth.uid()
  if auth.uid() is not null then
    if new.org_id is distinct from old.org_id then
      raise exception 'Cannot change organisation';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Cannot change email';
    end if;
    if new.roles is distinct from old.roles or new.role is distinct from old.role then
      if not public.is_org_admin() or old.org_id <> public.get_current_user_org_id() then
        raise exception 'Only an admin of this organisation can change roles';
      end if;
      if new.id = auth.uid() and not ('admin' = any(new.roles)) then
        raise exception 'You cannot remove your own admin role';
      end if;
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

-- First sign-in: all roles waiting for this email
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_roles text[] := array['student'];
begin
  select id into v_org_id from public.organisations where slug = 'sadhana-mandala' limit 1;

  select coalesce(g.roles, array[g.role]) into v_roles
  from public.role_grants g
  where g.org_id = v_org_id and lower(g.email) = lower(new.email)
  limit 1;
  v_roles := coalesce(v_roles, array['student']);

  insert into public.profiles (id, org_id, email, full_name, role, roles)
  values (
    new.id,
    v_org_id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    public.primary_role(v_roles),
    v_roles
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

  return new;
end;
$$;
