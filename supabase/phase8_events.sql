-- ============================================================================
-- Sadhana Mandala: Phase 8 migration (events, registrations, attendance)
--
-- SPEC.md "Events": intro talks, programme runs, satsangs and follow-up
-- sessions: schedule, venue or online link, capacity, registration and
-- attendance (QR check-in).
--
-- - events: one event of the organisation (admins and teachers manage them;
--   members see published events)
-- - event_registrations: a member (profile_id) or a guest without an account
--   (guest name, email, phone, added by staff) registered for an event, with
--   attendance (registered, attended, no_show, cancelled)
-- - Capacity is enforced by the database for everyone (trigger), so an event
--   can never be overbooked.
-- - Members register, cancel and check in only through the RPCs below. They
--   see their own registrations, never other attendees.
-- - QR check-in: each event has a secret check-in code (members cannot read
--   the column; staff get it from event_checkin_code() to show the QR).
--   check_in_to_event(code) works from 2 hours before the start until the
--   end (or 6 hours after the start when no end is set) and registers the
--   member if needed.
--
-- Only adds tables, functions and policies; nothing is dropped.
-- Safe to run more than once. Run after supabase/phase7_followups.sql.
-- ============================================================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  kind text not null default 'other' check (kind in ('intro_talk', 'programme', 'satsang', 'followup', 'other')),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue text,
  online_url text check (online_url is null or online_url ~* '^https://'),
  capacity integer check (capacity is null or capacity > 0),
  course_id uuid references public.courses(id) on delete set null,
  batch_id uuid references public.batches(id) on delete set null,
  host_id uuid references public.profiles(id) on delete set null,
  published boolean not null default true,
  checkin_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (ends_at is null or ends_at > starts_at)
);
create index if not exists events_org_start_idx on public.events (org_id, starts_at);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  guest_name text,
  guest_email text,
  guest_phone text,
  status text not null default 'registered' check (status in ('registered', 'attended', 'no_show', 'cancelled')),
  checked_in_at timestamptz,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_registrations_who check (profile_id is not null or nullif(trim(guest_name), '') is not null)
);
create unique index if not exists event_registrations_member_key
  on public.event_registrations (event_id, profile_id) where profile_id is not null;
create unique index if not exists event_registrations_guest_email_key
  on public.event_registrations (event_id, lower(guest_email)) where profile_id is null and guest_email is not null;
create index if not exists event_registrations_event_idx on public.event_registrations (event_id);

alter table public.events enable row level security;
alter table public.event_registrations enable row level security;

-- ----------------------------------------------------------------------------
-- Capacity: registered + attended may never exceed the event's capacity
-- ----------------------------------------------------------------------------
create or replace function public.enforce_event_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_capacity integer;
  v_taken integer;
begin
  if new.status not in ('registered', 'attended') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('registered', 'attended') then
    return new; -- already holding a place
  end if;

  -- Lock the event so two registrations cannot take the last place together
  select capacity into v_capacity from public.events where id = new.event_id for update;
  if v_capacity is null then
    return new;
  end if;

  select count(*) into v_taken from public.event_registrations
  where event_id = new.event_id and status in ('registered', 'attended') and id <> new.id;
  if v_taken >= v_capacity then
    raise exception 'This event is full' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger tr_event_capacity
  before insert or update of status on public.event_registrations
  for each row execute function public.enforce_event_capacity();

-- ----------------------------------------------------------------------------
-- Member RPCs (security definer: members never write the table directly)
-- ----------------------------------------------------------------------------
create or replace function public.register_for_event(p_event_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.get_current_user_org_id();
  e record;
begin
  if v_user is null or v_org is null then
    return json_build_object('success', false, 'message', 'Please sign in first.');
  end if;
  select * into e from public.events where id = p_event_id and org_id = v_org and published;
  if e.id is null then
    return json_build_object('success', false, 'message', 'Event not found.');
  end if;
  if coalesce(e.ends_at, e.starts_at + interval '6 hours') < now() then
    return json_build_object('success', false, 'message', 'This event has already taken place.');
  end if;

  insert into public.event_registrations (org_id, event_id, profile_id, status, added_by)
  values (v_org, e.id, v_user, 'registered', v_user)
  on conflict (event_id, profile_id) where profile_id is not null
  do update set status = 'registered', updated_at = now()
  where public.event_registrations.status in ('cancelled', 'no_show');

  return json_build_object('success', true);
exception when check_violation then
  return json_build_object('success', false, 'message', 'Sorry, this event is full.');
end;
$$;

create or replace function public.cancel_my_registration(p_event_id uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  update public.event_registrations
  set status = 'cancelled', updated_at = now()
  where event_id = p_event_id and profile_id = auth.uid() and status = 'registered';
  return json_build_object('success', true);
end;
$$;

create or replace function public.check_in_to_event(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.get_current_user_org_id();
  e record;
begin
  if v_user is null or v_org is null then
    return json_build_object('success', false, 'message', 'Please sign in first.');
  end if;
  select * into e from public.events
  where upper(checkin_code) = upper(trim(p_code)) and org_id = v_org and published;
  if e.id is null then
    return json_build_object('success', false, 'message', 'This check-in code is not valid.');
  end if;
  if now() < e.starts_at - interval '2 hours'
     or now() > coalesce(e.ends_at, e.starts_at + interval '6 hours') then
    return json_build_object('success', false, 'message', 'Check-in is only open around the time of the event.', 'title', e.title);
  end if;

  insert into public.event_registrations (org_id, event_id, profile_id, status, checked_in_at, added_by)
  values (v_org, e.id, v_user, 'attended', now(), v_user)
  on conflict (event_id, profile_id) where profile_id is not null
  do update set status = 'attended', checked_in_at = coalesce(public.event_registrations.checked_in_at, now()), updated_at = now();

  return json_build_object('success', true, 'title', e.title);
exception when check_violation then
  return json_build_object('success', false, 'message', 'Sorry, this event is full.', 'title', e.title);
end;
$$;

-- Places taken per published event (members cannot count other registrations)
create or replace function public.event_places_taken(p_event_ids uuid[])
returns table (event_id uuid, taken integer)
language sql security definer stable set search_path = public as $$
  select r.event_id, count(*)::integer
  from public.event_registrations r
  join public.events e on e.id = r.event_id
  where r.event_id = any(p_event_ids)
    and r.status in ('registered', 'attended')
    and e.org_id = public.get_current_user_org_id()
    and (e.published or public.is_org_staff())
  group by r.event_id;
$$;

-- The check-in code is secret: nobody selects it directly; staff use this
create or replace function public.event_checkin_code(p_event_id uuid)
returns text language sql security definer stable set search_path = public as $$
  select checkin_code from public.events
  where id = p_event_id and org_id = public.get_current_user_org_id() and public.is_org_staff();
$$;

revoke select on public.events from authenticated, anon;
grant select (id, org_id, kind, title, description, starts_at, ends_at, venue, online_url, capacity,
              course_id, batch_id, host_id, published, created_by, created_at, updated_at)
  on public.events to authenticated;

revoke execute on function public.event_checkin_code(uuid) from public, anon;
grant execute on function public.event_checkin_code(uuid) to authenticated;

revoke execute on function public.register_for_event(uuid), public.cancel_my_registration(uuid),
  public.check_in_to_event(text), public.event_places_taken(uuid[]), public.enforce_event_capacity() from public, anon;
grant execute on function public.register_for_event(uuid), public.cancel_my_registration(uuid),
  public.check_in_to_event(text), public.event_places_taken(uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- Policies (created only if missing; nothing dropped)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'events' and policyname = 'events_select') then
    create policy "events_select" on public.events
      for select to authenticated
      using (org_id = public.get_current_user_org_id() and (published or public.is_org_staff()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'events' and policyname = 'events_staff_manage') then
    create policy "events_staff_manage" on public.events
      for all to authenticated
      using (org_id = public.get_current_user_org_id() and public.is_org_staff())
      with check (org_id = public.get_current_user_org_id() and public.is_org_staff());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'event_registrations' and policyname = 'registrations_staff_manage') then
    create policy "registrations_staff_manage" on public.event_registrations
      for all to authenticated
      using (org_id = public.get_current_user_org_id() and public.is_org_staff())
      with check (org_id = public.get_current_user_org_id() and public.is_org_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'event_registrations' and policyname = 'registrations_select_own') then
    create policy "registrations_select_own" on public.event_registrations
      for select to authenticated
      using (profile_id = auth.uid());
  end if;
end $$;
