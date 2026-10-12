-- ============================================================================
-- Sadhana Mandala: Phase 9 migration (CRM for volunteers, batch QR join)
--
-- SPEC.md "CRM (for volunteers)":
-- - New role: volunteer (in addition to student, teacher, admin). A volunteer
--   is a student with access to the CRM for their own leads only.
-- - crm_contacts: people without an account yet (leads), with a pipeline
--   stage (new, invited, attended, interested, registered, completed, lost),
--   source, owner volunteer, interest programme, consent and opt-out.
--   furthest_stage remembers the furthest stage reached (for the funnel).
-- - crm_activities: notes, calls, messages and stage changes per contact.
-- - Converting a lead:
--     crm_invite_to_event(contact, event)   registers them for an event
--                                            (as a guest, or as the member
--                                            once they have an account)
--     crm_register_for_batch(contact, batch) enrols the member, or adds a
--                                            batch invite for their email so
--                                            they are enrolled on sign-in
-- - When a lead signs up, the contact links to their account (same email).
-- - The stage moves forward by itself: attended an event -> attended,
--   enrolled in a batch -> registered.
-- - Batch QR join: batch_join_preview(code) lets the sign-in page show which
--   batch a scanned QR code is for, before the person signs in.
-- - Phase 10 funnel report: crm_funnel_report() for admins and teachers.
--
-- Access: admins and teachers see and manage every contact of their
-- organisation. Volunteers see and manage only contacts they own. Students
-- see nothing.
--
-- Adds tables, columns, functions and policies. The only change to existing
-- objects: the role checks on profiles and role_grants are replaced so they
-- also allow 'volunteer'. Safe to run more than once.
-- Run after supabase/phase8_events.sql, then seed_dummy_data.sql, then
-- verify.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Volunteer role
-- ----------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'volunteer', 'teacher', 'admin'));
alter table public.role_grants drop constraint if exists role_grants_role_check;
alter table public.role_grants add constraint role_grants_role_check
  check (role in ('student', 'volunteer', 'teacher', 'admin'));

-- Caller may use the CRM (volunteer, teacher or admin)
create or replace function public.is_org_crm()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select role in ('volunteer', 'teacher', 'admin') from public.profiles where id = auth.uid()), false);
$$;

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------
create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  email text,
  phone text,
  source text not null default 'other'
    check (source in ('friend', 'walk_in', 'social', 'event', 'website', 'other')),
  stage text not null default 'new'
    check (stage in ('new', 'invited', 'attended', 'interested', 'registered', 'completed', 'lost')),
  furthest_stage text not null default 'new'
    check (furthest_stage in ('new', 'invited', 'attended', 'interested', 'registered', 'completed')),
  interest_course_id uuid references public.courses(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  consent_at timestamptz,          -- the person agreed to be contacted (PDPL)
  opted_out boolean not null default false,
  next_action_on date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_contacts_org_idx on public.crm_contacts (org_id, stage);
create index if not exists crm_contacts_owner_idx on public.crm_contacts (owner_id);
create index if not exists crm_contacts_email_idx on public.crm_contacts (org_id, lower(email));

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note', 'call', 'whatsapp', 'email', 'meeting', 'stage')),
  body text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists crm_activities_contact_idx on public.crm_activities (contact_id, created_at desc);

-- An event registration made for a CRM contact
alter table public.event_registrations
  add column if not exists contact_id uuid references public.crm_contacts(id) on delete set null;

alter table public.crm_contacts enable row level security;
alter table public.crm_activities enable row level security;

-- ----------------------------------------------------------------------------
-- 3. Helpers
-- ----------------------------------------------------------------------------
create or replace function public.crm_stage_rank(p_stage text)
returns integer language sql immutable as $$
  select case p_stage
    when 'new' then 0 when 'invited' then 1 when 'attended' then 2 when 'interested' then 3
    when 'registered' then 4 when 'completed' then 5 else -1 end;
$$;

-- Caller may see and change this contact
create or replace function public.can_manage_contact(p_contact_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.crm_contacts c
    where c.id = p_contact_id
      and c.org_id = public.get_current_user_org_id()
      and (public.is_org_staff() or (public.is_org_crm() and c.owner_id = auth.uid()))
  );
$$;

-- Normalise a contact before it is saved
create or replace function public.crm_contact_before_save()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only admins and teachers may set the linked account by hand
  -- (automatic links made by other triggers run at a deeper trigger level)
  if auth.uid() is not null and pg_trigger_depth() = 1 and not public.is_org_staff() then
    new.profile_id := case when tg_op = 'UPDATE' then old.profile_id end;
  end if;
  new.email := nullif(lower(trim(coalesce(new.email, ''))), '');
  new.phone := nullif(trim(coalesce(new.phone, '')), '');
  if new.stage <> 'lost' and public.crm_stage_rank(new.stage) > public.crm_stage_rank(new.furthest_stage) then
    new.furthest_stage := new.stage;
  end if;
  if tg_op = 'INSERT' then
    -- Link to an existing account with the same email
    if new.profile_id is null and new.email is not null then
      select id into new.profile_id from public.profiles
      where org_id = new.org_id and lower(email) = new.email limit 1;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger tr_crm_contact_before_save
  before insert or update on public.crm_contacts
  for each row execute function public.crm_contact_before_save();

-- Move a contact forward to a stage (never backwards); logs the change
create or replace function public.crm_advance(p_contact_id uuid, p_stage text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  select * into c from public.crm_contacts where id = p_contact_id;
  if c.id is null then return; end if;
  if c.stage <> 'lost' and public.crm_stage_rank(c.stage) >= public.crm_stage_rank(p_stage) then
    return;
  end if;
  update public.crm_contacts set stage = p_stage where id = p_contact_id;
  insert into public.crm_activities (org_id, contact_id, kind, body, created_by)
  values (c.org_id, c.id, 'stage', p_note, auth.uid());
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Automatic links and stage changes
-- ----------------------------------------------------------------------------
-- A lead signs up: link their contact (same organisation and email)
create or replace function public.crm_link_new_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and new.email <> '' then
    update public.crm_contacts
    set profile_id = new.id
    where org_id = new.org_id and profile_id is null and email = lower(new.email);
  end if;
  return new;
end;
$$;

create or replace trigger tr_crm_link_new_profile
  after insert on public.profiles
  for each row execute function public.crm_link_new_profile();

-- Attended an event -> stage "attended"
create or replace function public.crm_on_registration()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  r record;
begin
  if new.status <> 'attended' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'attended' then return new; end if;
  select title into v_title from public.events where id = new.event_id;
  for r in
    select id from public.crm_contacts
    where id = new.contact_id
       or (new.profile_id is not null and profile_id = new.profile_id and org_id = new.org_id)
  loop
    perform public.crm_advance(r.id, 'attended', 'Attended "' || coalesce(v_title, 'an event') || '"');
  end loop;
  return new;
end;
$$;

create or replace trigger tr_crm_on_registration
  after insert or update of status on public.event_registrations
  for each row execute function public.crm_on_registration();

-- Enrolled in a batch -> stage "registered"
create or replace function public.crm_on_enrolment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  r record;
begin
  select c.name || ' (' || b.name || ')' into v_name
  from public.batches b join public.courses c on c.id = b.course_id where b.id = new.batch_id;
  for r in select id from public.crm_contacts where profile_id = new.student_id and org_id = new.org_id loop
    perform public.crm_advance(r.id, 'registered', 'Enrolled in ' || coalesce(v_name, 'a programme'));
  end loop;
  return new;
end;
$$;

create or replace trigger tr_crm_on_enrolment
  after insert on public.enrolments
  for each row execute function public.crm_on_enrolment();

-- ----------------------------------------------------------------------------
-- 5. Conversion RPCs
-- ----------------------------------------------------------------------------
create or replace function public.crm_invite_to_event(p_contact_id uuid, p_event_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  c record;
  e record;
begin
  if not public.can_manage_contact(p_contact_id) then
    return json_build_object('success', false, 'message', 'You cannot change this contact.');
  end if;
  select * into c from public.crm_contacts where id = p_contact_id;
  select * into e from public.events where id = p_event_id and org_id = c.org_id and published;
  if e.id is null then
    return json_build_object('success', false, 'message', 'Event not found.');
  end if;
  if coalesce(e.ends_at, e.starts_at + interval '6 hours') < now() then
    return json_build_object('success', false, 'message', 'This event has already taken place.');
  end if;

  if exists (select 1 from public.event_registrations
             where event_id = e.id and status <> 'cancelled'
               and (contact_id = c.id or (c.profile_id is not null and profile_id = c.profile_id))) then
    return json_build_object('success', true, 'message', 'Already registered.', 'title', e.title);
  end if;

  if c.profile_id is not null then
    insert into public.event_registrations (org_id, event_id, profile_id, contact_id, status, added_by)
    values (c.org_id, e.id, c.profile_id, c.id, 'registered', auth.uid())
    on conflict (event_id, profile_id) where profile_id is not null
    do update set status = 'registered', contact_id = excluded.contact_id, updated_at = now();
  elsif c.email is not null and exists (
      select 1 from public.event_registrations
      where event_id = e.id and profile_id is null and lower(guest_email) = c.email) then
    update public.event_registrations
    set status = 'registered', contact_id = c.id, updated_at = now()
    where event_id = e.id and profile_id is null and lower(guest_email) = c.email;
  else
    insert into public.event_registrations (org_id, event_id, contact_id, guest_name, guest_email, guest_phone, status, added_by)
    values (c.org_id, e.id, c.id, c.full_name, c.email, c.phone, 'registered', auth.uid());
  end if;

  perform public.crm_advance(c.id, 'invited', 'Invited to "' || e.title || '"');
  return json_build_object('success', true, 'title', e.title);
exception when check_violation then
  return json_build_object('success', false, 'message', 'Sorry, this event is full.');
end;
$$;

create or replace function public.crm_register_for_batch(p_contact_id uuid, p_batch_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  c record;
  b record;
begin
  if not public.can_manage_contact(p_contact_id) then
    return json_build_object('success', false, 'message', 'You cannot change this contact.');
  end if;
  select * into c from public.crm_contacts where id = p_contact_id;
  select b2.*, co.name as course_name into b
  from public.batches b2 join public.courses co on co.id = b2.course_id
  where b2.id = p_batch_id and b2.org_id = c.org_id;
  if b.id is null then
    return json_build_object('success', false, 'message', 'Batch not found.');
  end if;

  if c.profile_id is not null then
    insert into public.enrolments (org_id, batch_id, student_id, source)
    values (c.org_id, b.id, c.profile_id, 'invite')
    on conflict (batch_id, student_id) do nothing;
  elsif c.email is not null then
    insert into public.batch_invites (org_id, batch_id, email)
    values (c.org_id, b.id, c.email)
    on conflict (batch_id, email) do nothing;
  else
    return json_build_object('success', false,
      'message', 'Add their email first, or send them the batch link so they can join themselves.',
      'join_code', b.join_code);
  end if;

  perform public.crm_advance(c.id, 'registered', 'Registered for ' || b.course_name || ' (' || b.name || ')');
  return json_build_object('success', true, 'batch_name', b.name, 'course_name', b.course_name,
                           'join_code', b.join_code, 'enrolled', c.profile_id is not null);
end;
$$;

-- People who can own contacts (for assigning), for admins and teachers
create or replace function public.crm_owners()
returns table (id uuid, full_name text, email text, role text)
language sql security definer stable set search_path = public as $$
  select p.id, p.full_name, p.email, p.role from public.profiles p
  where p.org_id = public.get_current_user_org_id()
    and p.role in ('volunteer', 'teacher', 'admin')
    and public.is_org_crm()
  order by p.full_name;
$$;

-- Batches a lead can be registered for (started in the last 14 days or
-- later), for everyone who uses the CRM (volunteers cannot read batches)
create or replace function public.crm_open_batches()
returns table (id uuid, name text, course_id uuid, course_name text, start_date date, join_code text)
language sql security definer stable set search_path = public as $$
  select b.id, b.name, c.id, c.name, b.start_date, b.join_code
  from public.batches b
  join public.courses c on c.id = b.course_id
  join public.organisations o on o.id = b.org_id
  where b.org_id = public.get_current_user_org_id()
    and public.is_org_crm()
    and b.start_date >= (now() at time zone o.timezone)::date - 14
  order by b.start_date, b.name;
$$;

-- ----------------------------------------------------------------------------
-- 6. Batch QR join preview (shown on the sign-in page before sign-in)
-- ----------------------------------------------------------------------------
create or replace function public.batch_join_preview(p_code text)
returns json language sql security definer stable set search_path = public as $$
  select json_build_object(
    'batch_name', b.name, 'course_name', c.name, 'start_date', b.start_date,
    'org_name', o.name, 'org_slug', o.slug)
  from public.batches b
  join public.courses c on c.id = b.course_id
  join public.organisations o on o.id = b.org_id
  where upper(b.join_code) = upper(trim(p_code))
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 7. Funnel report (Phase 10): admins and teachers of the organisation
-- ----------------------------------------------------------------------------
-- p_since: count leads created and enrolments made on or after this date
-- (null = all time). "Completed the practice" = practice period over and
-- "done" on at least 80% of its days.
create or replace function public.crm_funnel_report(p_since date default null)
returns json language plpgsql security definer stable set search_path = public as $$
declare
  v_org uuid := public.get_current_user_org_id();
  v_today date;
  v_leads json;
  v_journey json;
  v_sources json;
  v_owners json;
begin
  if v_org is null or not public.is_org_staff() then
    return json_build_object('success', false, 'message', 'Only admins and teachers can see reports.');
  end if;
  select (now() at time zone timezone)::date into v_today from public.organisations where id = v_org;

  with c as (
    select * from public.crm_contacts
    where org_id = v_org and (p_since is null or created_at >= p_since)
  )
  select json_build_object(
    'total', count(*),
    'invited', count(*) filter (where public.crm_stage_rank(furthest_stage) >= 1),
    'attended', count(*) filter (where public.crm_stage_rank(furthest_stage) >= 2),
    'interested', count(*) filter (where public.crm_stage_rank(furthest_stage) >= 3),
    'registered', count(*) filter (where public.crm_stage_rank(furthest_stage) >= 4),
    'completed', count(*) filter (where public.crm_stage_rank(furthest_stage) >= 5),
    'lost', count(*) filter (where stage = 'lost'),
    'signed_up', count(*) filter (where profile_id is not null)
  ) into v_leads from c;

  select coalesce(json_agg(json_build_object('source', source, 'leads', n, 'registered', reg) order by n desc), '[]')
  into v_sources
  from (
    select source, count(*) n, count(*) filter (where public.crm_stage_rank(furthest_stage) >= 4) reg
    from public.crm_contacts
    where org_id = v_org and (p_since is null or created_at >= p_since)
    group by source
  ) s;

  select coalesce(json_agg(json_build_object('owner_id', owner_id, 'name', name, 'leads', n, 'registered', reg) order by n desc), '[]')
  into v_owners
  from (
    select c.owner_id, coalesce(nullif(p.full_name, ''), p.email, 'Unassigned') as name, count(*) n,
           count(*) filter (where public.crm_stage_rank(c.furthest_stage) >= 4) reg
    from public.crm_contacts c left join public.profiles p on p.id = c.owner_id
    where c.org_id = v_org and (p_since is null or c.created_at >= p_since)
    group by c.owner_id, p.full_name, p.email
  ) o;

  -- Student journey per programme with a daily practice track
  with enr as (
    select e.student_id, e.joined_at, b.id batch_id, b.start_date, co.id course_id, co.name course_name,
           co.duration_days, co.sort_order
    from public.enrolments e
    join public.batches b on b.id = e.batch_id
    join public.courses co on co.id = b.course_id
    where e.org_id = v_org and co.has_practice_track
      and (p_since is null or e.joined_at >= p_since)
  ),
  per as (
    select enr.*,
      (enr.start_date + enr.duration_days - 1) < v_today as track_over,
      (select count(*) from public.checkins k
        where k.batch_id = enr.batch_id and k.student_id = enr.student_id and k.status = 'done') as done_days,
      exists (
        select 1 from public.enrolments e2
        join public.batches b2 on b2.id = e2.batch_id
        where e2.student_id = enr.student_id and b2.course_id <> enr.course_id
          and b2.start_date > enr.start_date
      ) as went_on
    from enr
  )
  select coalesce(json_agg(json_build_object(
      'course_id', course_id, 'course_name', course_name, 'practice_days', duration_days,
      'enrolled', enrolled, 'track_over', track_over, 'completed', completed, 'next_programme', went_on)
      order by sort_order, course_name), '[]')
  into v_journey
  from (
    select course_id, course_name, duration_days, sort_order,
           count(distinct student_id) enrolled,
           count(distinct student_id) filter (where track_over) track_over,
           count(distinct student_id) filter (where track_over and done_days >= ceil(duration_days * 0.8)) completed,
           count(distinct student_id) filter (where went_on) went_on
    from per
    group by course_id, course_name, duration_days, sort_order
  ) j;

  return json_build_object('success', true, 'since', p_since, 'leads', v_leads,
                           'sources', v_sources, 'owners', v_owners, 'journey', v_journey);
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Grants
-- ----------------------------------------------------------------------------
revoke execute on function public.crm_advance(uuid, text, text), public.crm_link_new_profile(), public.crm_contact_before_save(),
  public.crm_on_registration(), public.crm_on_enrolment() from public, anon, authenticated;
revoke execute on function public.crm_invite_to_event(uuid, uuid), public.crm_register_for_batch(uuid, uuid),
  public.crm_owners(), public.crm_open_batches(), public.crm_funnel_report(date), public.can_manage_contact(uuid),
  public.is_org_crm()
  from public, anon;
grant execute on function public.crm_invite_to_event(uuid, uuid), public.crm_register_for_batch(uuid, uuid),
  public.crm_owners(), public.crm_open_batches(), public.crm_funnel_report(date), public.can_manage_contact(uuid),
  public.is_org_crm()
  to authenticated;
grant execute on function public.batch_join_preview(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. Policies (created only if missing; nothing dropped)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'crm_contacts' and policyname = 'crm_contacts_staff') then
    create policy "crm_contacts_staff" on public.crm_contacts
      for all to authenticated
      using (org_id = public.get_current_user_org_id() and public.is_org_staff())
      with check (org_id = public.get_current_user_org_id() and public.is_org_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'crm_contacts' and policyname = 'crm_contacts_volunteer_own') then
    create policy "crm_contacts_volunteer_own" on public.crm_contacts
      for all to authenticated
      using (org_id = public.get_current_user_org_id() and public.is_org_crm() and owner_id = auth.uid())
      with check (org_id = public.get_current_user_org_id() and public.is_org_crm() and owner_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'crm_activities' and policyname = 'crm_activities_select') then
    create policy "crm_activities_select" on public.crm_activities
      for select to authenticated
      using (public.can_manage_contact(contact_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'crm_activities' and policyname = 'crm_activities_insert') then
    create policy "crm_activities_insert" on public.crm_activities
      for insert to authenticated
      with check (public.can_manage_contact(contact_id) and created_by = auth.uid()
                  and org_id = public.get_current_user_org_id() and kind <> 'stage');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'crm_activities' and policyname = 'crm_activities_delete_own') then
    create policy "crm_activities_delete_own" on public.crm_activities
      for delete to authenticated
      using (created_by = auth.uid() and public.can_manage_contact(contact_id));
  end if;
end $$;
