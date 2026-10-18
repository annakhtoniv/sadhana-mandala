-- ============================================================================
-- CI only: the database schema as it stands on the live project after Phase 13
-- (dumped 2026-10-18 from a local copy that matches live: 48 public rules,
-- 7 storage rules, 18 tables, 9 triggers, the same 50 functions). Includes
-- small stand-ins for Supabase's auth and storage schemas.
-- GitHub rebuilds the database from this file, applies the newer phase files,
-- the sample data and verify.sql on every pull request.
-- Do NOT run this in Supabase.
-- ============================================================================
--
-- PostgreSQL database dump
--

\restrict nJBxQdjBh2IJmzn0fwrexl35v6ec2gfmrQwRreBC0WsGbtWwWUW2YpcLciRazaQ

-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$ select nullif(auth.jwt()->>'sub','')::uuid $$;


--
-- Name: add_batch_invites(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_batch_invites(p_batch_id uuid, p_emails text[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: batch_accepts_checkin(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.batch_accepts_checkin(p_batch_id uuid, p_day integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.batches b
    join public.courses c on c.id = b.course_id
    where b.id = p_batch_id
      and c.has_practice_track
      and p_day between 1 and c.duration_days
  );
$$;


--
-- Name: batch_current_day(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.batch_current_day(p_batch_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select ((now() at time zone coalesce(o.timezone, 'Asia/Dubai'))::date - b.start_date) + 1
  from public.batches b
  join public.organisations o on o.id = b.org_id
  where b.id = p_batch_id;
$$;


--
-- Name: batch_join_preview(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.batch_join_preview(p_code text) RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select json_build_object(
    'batch_name', b.name, 'course_name', c.name, 'start_date', b.start_date,
    'org_name', o.name, 'org_slug', o.slug)
  from public.batches b
  join public.courses c on c.id = b.course_id
  join public.organisations o on o.id = b.org_id
  where upper(b.join_code) = upper(trim(p_code))
  limit 1;
$$;


--
-- Name: can_manage_contact(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_contact(p_contact_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.crm_contacts c
    where c.id = p_contact_id
      and c.org_id = public.get_current_user_org_id()
      and (public.is_org_staff() or (public.is_org_crm() and c.owner_id = auth.uid()))
  );
$$;


--
-- Name: can_manage_material_path(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_material_path(p_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select split_part(p_name, '/', 1) = public.get_current_user_org_id()::text
     and public.is_org_staff()
     and exists (select 1 from public.courses c
                 where c.id::text = split_part(p_name, '/', 2) and c.org_id = public.get_current_user_org_id());
$$;


--
-- Name: can_read_material_path(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_material_path(p_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select split_part(p_name, '/', 1) = public.get_current_user_org_id()::text
     and (
       public.is_org_staff()
       or exists (
         select 1 from public.enrolments e
         join public.batches b on b.id = e.batch_id
         where e.student_id = auth.uid() and b.course_id::text = split_part(p_name, '/', 2)
       )
     );
$$;


--
-- Name: cancel_my_registration(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_my_registration(p_event_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.event_registrations
  set status = 'cancelled', updated_at = now()
  where event_id = p_event_id and profile_id = auth.uid() and status = 'registered';
  return json_build_object('success', true);
end;
$$;


--
-- Name: check_in_to_event(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_in_to_event(p_code text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: checkin_before_save(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.checkin_before_save() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_today integer;
begin
  -- Older app versions only send status
  if not new.morning and not new.evening and new.status = 'done'
     and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.morning := true;
  end if;

  if new.morning or new.evening then
    new.status := 'done';
  elsif tg_op = 'UPDATE' and (new.morning is distinct from old.morning or new.evening is distinct from old.evening) then
    new.status := 'not_yet';
  end if;

  if new.morning and (tg_op = 'INSERT' or not old.morning) then
    new.morning_at := now();
  elsif not new.morning then
    new.morning_at := null;
  end if;
  if new.evening and (tg_op = 'INSERT' or not old.evening) then
    new.evening_at := now();
  elsif not new.evening then
    new.evening_at := null;
  end if;

  -- Written by a student after the day itself
  if auth.uid() is not null and auth.uid() = new.student_id then
    v_today := public.batch_current_day(new.batch_id);
    if v_today is not null and new.day_number < v_today then
      new.late := true;
    end if;
  end if;
  if tg_op = 'UPDATE' and old.late then
    new.late := true;
  end if;

  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: claim_pending_invites(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_pending_invites() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: crm_advance(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_advance(p_contact_id uuid, p_stage text, p_note text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: crm_contact_before_save(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_contact_before_save() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: crm_funnel_report(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_funnel_report(p_since date DEFAULT NULL::date) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: crm_invite_to_event(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_invite_to_event(p_contact_id uuid, p_event_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: crm_link_new_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_link_new_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.email is not null and new.email <> '' then
    update public.crm_contacts
    set profile_id = new.id
    where org_id = new.org_id and profile_id is null and email = lower(new.email);
  end if;
  return new;
end;
$$;


--
-- Name: crm_on_enrolment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_on_enrolment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: crm_on_registration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_on_registration() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: crm_open_batches(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_open_batches() RETURNS TABLE(id uuid, name text, course_id uuid, course_name text, start_date date, join_code text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select b.id, b.name, c.id, c.name, b.start_date, b.join_code
  from public.batches b
  join public.courses c on c.id = b.course_id
  join public.organisations o on o.id = b.org_id
  where b.org_id = public.get_current_user_org_id()
    and public.is_org_crm()
    and b.start_date >= (now() at time zone o.timezone)::date - 14
  order by b.start_date, b.name;
$$;


--
-- Name: crm_owners(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_owners() RETURNS TABLE(id uuid, full_name text, email text, role text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.id, p.full_name, p.email, p.role from public.profiles p
  where p.org_id = public.get_current_user_org_id()
    and p.role in ('volunteer', 'teacher', 'admin')
    and public.is_org_crm()
  order by p.full_name;
$$;


--
-- Name: crm_register_for_batch(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_register_for_batch(p_contact_id uuid, p_batch_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: crm_stage_rank(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crm_stage_rank(p_stage text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  select case p_stage
    when 'new' then 0 when 'invited' then 1 when 'attended' then 2 when 'interested' then 3
    when 'registered' then 4 when 'completed' then 5 else -1 end;
$$;


--
-- Name: delete_user_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user_account() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  update public.batch_invites set claimed_by = null where claimed_by = v_user_id;
  delete from public.profiles where id = v_user_id;
  delete from auth.users where id = v_user_id;
end;
$$;


--
-- Name: enforce_event_capacity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_event_capacity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: event_checkin_code(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.event_checkin_code(p_event_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select checkin_code from public.events
  where id = p_event_id and org_id = public.get_current_user_org_id() and public.is_org_staff();
$$;


--
-- Name: event_places_taken(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.event_places_taken(p_event_ids uuid[]) RETURNS TABLE(event_id uuid, taken integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select r.event_id, count(*)::integer
  from public.event_registrations r
  join public.events e on e.id = r.event_id
  where r.event_id = any(p_event_ids)
    and r.status in ('registered', 'attended')
    and e.org_id = public.get_current_user_org_id()
    and (e.published or public.is_org_staff())
  group by r.event_id;
$$;


--
-- Name: get_current_user_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_user_org_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select org_id from public.profiles where id = auth.uid();
$$;


--
-- Name: get_current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select role from public.profiles where id = auth.uid();
$$;


--
-- Name: give_user_consent(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.give_user_consent() RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_now timestamptz := now();
begin
  update public.profiles set consent_at = v_now where id = auth.uid();
  return v_now;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: is_batch_teacher(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_batch_teacher(p_batch_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.batches b
    where b.id = p_batch_id
      and b.teacher_id = auth.uid()
      and b.org_id = public.get_current_user_org_id()
  );
$$;


--
-- Name: is_enrolled_in_batch(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_enrolled_in_batch(p_batch_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.enrolments e
    where e.batch_id = p_batch_id and e.student_id = auth.uid()
  );
$$;


--
-- Name: is_enrolled_in_course(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_enrolled_in_course(p_course_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.enrolments e
    join public.batches b on b.id = e.batch_id
    where e.student_id = auth.uid() and b.course_id = p_course_id
  );
$$;


--
-- Name: is_my_teacher(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_my_teacher(p_profile_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.enrolments e
    join public.batches b on b.id = e.batch_id
    where e.student_id = auth.uid() and b.teacher_id = p_profile_id
  );
$$;


--
-- Name: is_org_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;


--
-- Name: is_org_crm(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_crm() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select role in ('volunteer', 'teacher', 'admin') from public.profiles where id = auth.uid()), false);
$$;


--
-- Name: is_org_staff(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_staff() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select role in ('admin', 'teacher') from public.profiles where id = auth.uid()), false);
$$;


--
-- Name: join_batch_by_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_batch_by_code(p_join_code text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid := public.get_current_user_org_id();
  v_batch record;
  v_enrolment_id uuid;
begin
  if v_user_id is null or v_org_id is null then
    return json_build_object('success', false, 'message', 'Please sign in first.');
  end if;

  -- A join code works only inside its own organisation
  select b.id, b.org_id, b.name into v_batch
  from public.batches b
  where upper(b.join_code) = upper(trim(p_join_code))
    and b.org_id = v_org_id
  limit 1;

  if v_batch.id is null then
    return json_build_object('success', false, 'message', 'Invalid join code. Please check with your teacher.');
  end if;

  insert into public.enrolments (org_id, batch_id, student_id, source)
  values (v_batch.org_id, v_batch.id, v_user_id, 'code')
  on conflict (batch_id, student_id) do update set joined_at = public.enrolments.joined_at
  returning id into v_enrolment_id;

  return json_build_object('success', true, 'batch_name', v_batch.name, 'enrolment_id', v_enrolment_id);
end;
$$;


--
-- Name: module_unlocked_for_me(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.module_unlocked_for_me(p_module_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  m record;
  v_day integer;
  v_prev uuid;
begin
  select * into m from public.lesson_modules where id = p_module_id;
  if m.id is null or not m.published or not public.is_enrolled_in_course(m.course_id) then
    return false;
  end if;

  if m.unlock_rule = 'always' then
    return true;
  elsif m.unlock_rule = 'day' then
    v_day := public.my_programme_day(m.course_id);
    return v_day is not null and v_day >= m.unlock_day;
  else
    -- 'sequential': the previous published module (by display order) must be complete
    select id into v_prev from public.lesson_modules
    where course_id = m.course_id and published and id <> m.id
      and (sort_order, created_at, id) < (m.sort_order, m.created_at, m.id)
    order by sort_order desc, created_at desc, id desc
    limit 1;
    return v_prev is null or public.my_module_complete(v_prev);
  end if;
end;
$$;


--
-- Name: my_batch_sessions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_batch_sessions(p_batch_id uuid) RETURNS TABLE(step_id uuid, title text, description text, offset_day integer, status text, scheduled_for timestamp with time zone, location text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select s.id, s.title, s.description, s.offset_day, r.status, r.scheduled_for, r.location
  from public.batches b
  join public.followup_steps s on s.course_id = b.course_id and s.kind = 'session' and s.is_active
  left join public.followup_records r on r.batch_id = b.id and r.step_id = s.id and r.student_id is null
  where b.id = p_batch_id
    and b.org_id = public.get_current_user_org_id()
    and (public.is_enrolled_in_batch(b.id) or public.is_org_admin() or public.is_batch_teacher(b.id))
  order by s.offset_day, s.sort_order;
$$;


--
-- Name: my_module_complete(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_module_complete(p_module_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select not exists (
    select 1 from public.lessons l
    where l.module_id = p_module_id and l.published
      and not exists (select 1 from public.lesson_progress p
                      where p.lesson_id = l.id and p.student_id = auth.uid())
  );
$$;


--
-- Name: my_programme_day(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_programme_day(p_course_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select max(((now() at time zone coalesce(o.timezone, 'Asia/Dubai'))::date - b.start_date) + 1)
  from public.enrolments e
  join public.batches b on b.id = e.batch_id
  join public.organisations o on o.id = b.org_id
  where e.student_id = auth.uid() and b.course_id = p_course_id;
$$;


--
-- Name: normalise_roles(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalise_roles(p_roles text[]) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (select array_agg(r order by array_position(array['student', 'volunteer', 'teacher', 'admin'], r))
     from (select distinct r from unnest(p_roles) as r
           where r in ('student', 'volunteer', 'teacher', 'admin')) x),
    array['student']);
$$;


--
-- Name: primary_role(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.primary_role(p_roles text[]) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select case
    when 'admin' = any(p_roles) then 'admin'
    when 'teacher' = any(p_roles) then 'teacher'
    when 'volunteer' = any(p_roles) then 'volunteer'
    else 'student'
  end;
$$;


--
-- Name: protect_profile_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_profile_fields() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: register_for_event(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_for_event(p_event_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: sync_my_google_avatar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_my_google_avatar() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_url text;
begin
  if auth.uid() is null then return null; end if;
  select coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
  into v_url from auth.users u where u.id = auth.uid();
  if v_url is null or v_url !~ '^https://lh[0-9]+\.googleusercontent\.com/' then
    return null;
  end if;
  update public.profiles
  set avatar_url = v_url, avatar_source = 'google'
  where id = auth.uid() and coalesce(avatar_source, 'google') = 'google'
    and avatar_url is distinct from v_url;
  return v_url;
end;
$$;


--
-- Name: sync_roles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_roles() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


--
-- Name: teaches_course(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.teaches_course(p_course_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.batches b
    where b.course_id = p_course_id and b.teacher_id = auth.uid()
  );
$$;


--
-- Name: teaches_student(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.teaches_student(p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.enrolments e
    join public.batches b on b.id = e.batch_id
    where e.student_id = p_student_id and b.teacher_id = auth.uid()
  );
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.' using errcode = '42501';
end $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    id uuid NOT NULL,
    email text,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);


--
-- Name: batch_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    batch_id uuid NOT NULL,
    email text NOT NULL,
    claimed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    course_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    name text NOT NULL,
    start_date date NOT NULL,
    join_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    student_id uuid NOT NULL,
    batch_id uuid NOT NULL,
    day_number integer NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    morning boolean DEFAULT false NOT NULL,
    evening boolean DEFAULT false NOT NULL,
    morning_at timestamp with time zone,
    evening_at timestamp with time zone,
    late boolean DEFAULT false NOT NULL,
    CONSTRAINT checkins_day_number_check CHECK ((day_number > 0)),
    CONSTRAINT checkins_status_check CHECK ((status = ANY (ARRAY['done'::text, 'not_yet'::text, 'rest'::text])))
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    duration_days integer DEFAULT 40 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    code text,
    category text DEFAULT 'Programme'::text NOT NULL,
    programme_days integer,
    has_practice_track boolean DEFAULT false NOT NULL,
    practice_name text,
    prerequisite_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT courses_duration_days_check CHECK ((duration_days > 0)),
    CONSTRAINT courses_programme_days_check CHECK (((programme_days IS NULL) OR (programme_days > 0)))
);


--
-- Name: COLUMN courses.duration_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.courses.duration_days IS 'Length of the daily practice track in days (used only when has_practice_track is true)';


--
-- Name: COLUMN courses.programme_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.courses.programme_days IS 'Length of the programme itself in days, if known (e.g. 3 for a weekend programme)';


--
-- Name: crm_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    kind text DEFAULT 'note'::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_activities_kind_check CHECK ((kind = ANY (ARRAY['note'::text, 'call'::text, 'whatsapp'::text, 'email'::text, 'meeting'::text, 'stage'::text])))
);


--
-- Name: crm_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    full_name text NOT NULL,
    email text,
    phone text,
    source text DEFAULT 'other'::text NOT NULL,
    stage text DEFAULT 'new'::text NOT NULL,
    furthest_stage text DEFAULT 'new'::text NOT NULL,
    interest_course_id uuid,
    owner_id uuid,
    profile_id uuid,
    consent_at timestamp with time zone,
    opted_out boolean DEFAULT false NOT NULL,
    next_action_on date,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_contacts_full_name_check CHECK ((length(TRIM(BOTH FROM full_name)) > 0)),
    CONSTRAINT crm_contacts_furthest_stage_check CHECK ((furthest_stage = ANY (ARRAY['new'::text, 'invited'::text, 'attended'::text, 'interested'::text, 'registered'::text, 'completed'::text]))),
    CONSTRAINT crm_contacts_source_check CHECK ((source = ANY (ARRAY['friend'::text, 'walk_in'::text, 'social'::text, 'event'::text, 'website'::text, 'other'::text]))),
    CONSTRAINT crm_contacts_stage_check CHECK ((stage = ANY (ARRAY['new'::text, 'invited'::text, 'attended'::text, 'interested'::text, 'registered'::text, 'completed'::text, 'lost'::text])))
);


--
-- Name: enrolments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrolments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    batch_id uuid NOT NULL,
    student_id uuid NOT NULL,
    source text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT enrolments_source_check CHECK ((source = ANY (ARRAY['invite'::text, 'code'::text, 'manual'::text])))
);


--
-- Name: event_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    event_id uuid NOT NULL,
    profile_id uuid,
    guest_name text,
    guest_email text,
    guest_phone text,
    status text DEFAULT 'registered'::text NOT NULL,
    checked_in_at timestamp with time zone,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_id uuid,
    CONSTRAINT event_registrations_status_check CHECK ((status = ANY (ARRAY['registered'::text, 'attended'::text, 'no_show'::text, 'cancelled'::text]))),
    CONSTRAINT event_registrations_who CHECK (((profile_id IS NOT NULL) OR (NULLIF(TRIM(BOTH FROM guest_name), ''::text) IS NOT NULL)))
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    kind text DEFAULT 'other'::text NOT NULL,
    title text NOT NULL,
    description text,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    venue text,
    online_url text,
    capacity integer,
    course_id uuid,
    batch_id uuid,
    host_id uuid,
    published boolean DEFAULT true NOT NULL,
    checkin_code text DEFAULT upper(substr(md5((gen_random_uuid())::text), 1, 8)) NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT events_capacity_check CHECK (((capacity IS NULL) OR (capacity > 0))),
    CONSTRAINT events_end_after_start CHECK (((ends_at IS NULL) OR (ends_at > starts_at))),
    CONSTRAINT events_kind_check CHECK ((kind = ANY (ARRAY['intro_talk'::text, 'programme'::text, 'satsang'::text, 'followup'::text, 'other'::text]))),
    CONSTRAINT events_online_url_check CHECK (((online_url IS NULL) OR (online_url ~* '^https://'::text)))
);


--
-- Name: followup_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.followup_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    batch_id uuid NOT NULL,
    step_id uuid NOT NULL,
    student_id uuid,
    status text NOT NULL,
    scheduled_for timestamp with time zone,
    location text,
    notes text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT followup_records_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'done'::text, 'skipped'::text])))
);


--
-- Name: followup_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.followup_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    course_id uuid NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    description text,
    offset_day integer NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT followup_steps_kind_check CHECK ((kind = ANY (ARRAY['session'::text, 'personal'::text, 'reminder'::text]))),
    CONSTRAINT followup_steps_offset_day_check CHECK ((offset_day >= 1))
);


--
-- Name: lesson_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    course_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    sort_order integer DEFAULT 100 NOT NULL,
    unlock_rule text DEFAULT 'always'::text NOT NULL,
    unlock_day integer,
    published boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lesson_modules_day_rule CHECK (((unlock_rule <> 'day'::text) OR (unlock_day IS NOT NULL))),
    CONSTRAINT lesson_modules_unlock_day_check CHECK (((unlock_day IS NULL) OR (unlock_day >= 1))),
    CONSTRAINT lesson_modules_unlock_rule_check CHECK ((unlock_rule = ANY (ARRAY['always'::text, 'day'::text, 'sequential'::text])))
);


--
-- Name: lesson_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    student_id uuid NOT NULL,
    lesson_id uuid NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lessons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    video_url text,
    scope text NOT NULL,
    course_id uuid,
    batch_id uuid,
    day_number integer,
    published boolean DEFAULT true NOT NULL,
    author_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    module_id uuid,
    sort_order integer DEFAULT 100 NOT NULL,
    estimated_minutes integer,
    CONSTRAINT lessons_estimated_minutes_check CHECK (((estimated_minutes IS NULL) OR (estimated_minutes > 0))),
    CONSTRAINT lessons_scope_check CHECK ((scope = ANY (ARRAY['general'::text, 'course'::text, 'batch'::text])))
);


--
-- Name: organisations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organisations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    app_name text NOT NULL,
    logo_url text,
    primary_colour text DEFAULT '#1c1917'::text NOT NULL,
    accent_colour text DEFAULT '#059669'::text NOT NULL,
    support_email text DEFAULT 'support@zyxenai.com'::text NOT NULL,
    checkin_question text DEFAULT 'Did you complete your daily practice today?'::text NOT NULL,
    footer_text text DEFAULT 'Mindful daily practice and teacher guidance'::text NOT NULL,
    timezone text DEFAULT 'Asia/Dubai'::text NOT NULL,
    show_powered_by boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    role text DEFAULT 'student'::text NOT NULL,
    consent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text,
    avatar_source text,
    roles text[] NOT NULL,
    CONSTRAINT profiles_avatar_source_check CHECK (((avatar_source IS NULL) OR (avatar_source = ANY (ARRAY['google'::text, 'upload'::text])))),
    CONSTRAINT profiles_avatar_url_check CHECK (((avatar_url IS NULL) OR (avatar_url ~ '^https://lh[0-9]+\.googleusercontent\.com/'::text) OR (avatar_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/'::text))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['student'::text, 'volunteer'::text, 'teacher'::text, 'admin'::text]))),
    CONSTRAINT profiles_roles_check CHECK (((cardinality(roles) >= 1) AND (roles <@ ARRAY['student'::text, 'volunteer'::text, 'teacher'::text, 'admin'::text])))
);


--
-- Name: programme_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.programme_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    course_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    kind text NOT NULL,
    storage_path text,
    url text,
    mime_type text,
    size_bytes bigint,
    sort_order integer DEFAULT 0 NOT NULL,
    published boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT programme_materials_kind_check CHECK ((kind = ANY (ARRAY['pdf'::text, 'audio'::text, 'video'::text, 'image'::text, 'file'::text, 'link'::text]))),
    CONSTRAINT programme_materials_source CHECK ((((kind = 'link'::text) AND (url IS NOT NULL)) OR ((kind <> 'link'::text) AND (storage_path IS NOT NULL)))),
    CONSTRAINT programme_materials_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0)),
    CONSTRAINT programme_materials_url_check CHECK (((url IS NULL) OR (url ~* '^https://'::text)))
);


--
-- Name: role_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    roles text[] NOT NULL,
    CONSTRAINT role_grants_role_check CHECK ((role = ANY (ARRAY['student'::text, 'volunteer'::text, 'teacher'::text, 'admin'::text]))),
    CONSTRAINT role_grants_roles_check CHECK (((cardinality(roles) >= 1) AND (roles <@ ARRAY['student'::text, 'volunteer'::text, 'teacher'::text, 'admin'::text])))
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text,
    public boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[]
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid DEFAULT auth.uid()
);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: batch_invites batch_invites_batch_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_invites
    ADD CONSTRAINT batch_invites_batch_id_email_key UNIQUE (batch_id, email);


--
-- Name: batch_invites batch_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_invites
    ADD CONSTRAINT batch_invites_pkey PRIMARY KEY (id);


--
-- Name: batches batches_org_id_join_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_org_id_join_code_key UNIQUE (org_id, join_code);


--
-- Name: batches batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_pkey PRIMARY KEY (id);


--
-- Name: checkins checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_pkey PRIMARY KEY (id);


--
-- Name: checkins checkins_student_id_batch_id_day_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_student_id_batch_id_day_number_key UNIQUE (student_id, batch_id, day_number);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: crm_activities crm_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_pkey PRIMARY KEY (id);


--
-- Name: crm_contacts crm_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contacts
    ADD CONSTRAINT crm_contacts_pkey PRIMARY KEY (id);


--
-- Name: enrolments enrolments_batch_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT enrolments_batch_id_student_id_key UNIQUE (batch_id, student_id);


--
-- Name: enrolments enrolments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT enrolments_pkey PRIMARY KEY (id);


--
-- Name: event_registrations event_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_pkey PRIMARY KEY (id);


--
-- Name: events events_checkin_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_checkin_code_key UNIQUE (checkin_code);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: followup_records followup_records_one_per_target; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followup_records
    ADD CONSTRAINT followup_records_one_per_target UNIQUE NULLS NOT DISTINCT (batch_id, step_id, student_id);


--
-- Name: followup_records followup_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followup_records
    ADD CONSTRAINT followup_records_pkey PRIMARY KEY (id);


--
-- Name: followup_steps followup_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followup_steps
    ADD CONSTRAINT followup_steps_pkey PRIMARY KEY (id);


--
-- Name: lesson_modules lesson_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_modules
    ADD CONSTRAINT lesson_modules_pkey PRIMARY KEY (id);


--
-- Name: lesson_progress lesson_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_progress
    ADD CONSTRAINT lesson_progress_pkey PRIMARY KEY (id);


--
-- Name: lesson_progress lesson_progress_student_id_lesson_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_progress
    ADD CONSTRAINT lesson_progress_student_id_lesson_id_key UNIQUE (student_id, lesson_id);


--
-- Name: lessons lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_pkey PRIMARY KEY (id);


--
-- Name: organisations organisations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organisations
    ADD CONSTRAINT organisations_pkey PRIMARY KEY (id);


--
-- Name: organisations organisations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organisations
    ADD CONSTRAINT organisations_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: programme_materials programme_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programme_materials
    ADD CONSTRAINT programme_materials_pkey PRIMARY KEY (id);


--
-- Name: role_grants role_grants_org_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_grants
    ADD CONSTRAINT role_grants_org_id_email_key UNIQUE (org_id, email);


--
-- Name: role_grants role_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_grants
    ADD CONSTRAINT role_grants_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: courses_org_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX courses_org_code_key ON public.courses USING btree (org_id, lower(code)) WHERE (code IS NOT NULL);


--
-- Name: crm_activities_contact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_activities_contact_idx ON public.crm_activities USING btree (contact_id, created_at DESC);


--
-- Name: crm_contacts_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_contacts_email_idx ON public.crm_contacts USING btree (org_id, lower(email));


--
-- Name: crm_contacts_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_contacts_org_idx ON public.crm_contacts USING btree (org_id, stage);


--
-- Name: crm_contacts_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_contacts_owner_idx ON public.crm_contacts USING btree (owner_id);


--
-- Name: event_registrations_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_registrations_event_idx ON public.event_registrations USING btree (event_id);


--
-- Name: event_registrations_guest_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX event_registrations_guest_email_key ON public.event_registrations USING btree (event_id, lower(guest_email)) WHERE ((profile_id IS NULL) AND (guest_email IS NOT NULL));


--
-- Name: event_registrations_member_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX event_registrations_member_key ON public.event_registrations USING btree (event_id, profile_id) WHERE (profile_id IS NOT NULL);


--
-- Name: events_org_start_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_org_start_idx ON public.events USING btree (org_id, starts_at);


--
-- Name: followup_records_batch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX followup_records_batch_idx ON public.followup_records USING btree (batch_id);


--
-- Name: followup_steps_course_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX followup_steps_course_idx ON public.followup_steps USING btree (course_id, offset_day);


--
-- Name: lesson_modules_course_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_modules_course_idx ON public.lesson_modules USING btree (course_id, sort_order);


--
-- Name: lesson_progress_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_progress_student_idx ON public.lesson_progress USING btree (student_id);


--
-- Name: lessons_module_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lessons_module_idx ON public.lessons USING btree (module_id, sort_order);


--
-- Name: programme_materials_course_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX programme_materials_course_idx ON public.programme_materials USING btree (course_id, sort_order);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: profiles tr_a_sync_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_a_sync_roles BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_roles();


--
-- Name: role_grants tr_a_sync_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_a_sync_roles BEFORE INSERT OR UPDATE ON public.role_grants FOR EACH ROW EXECUTE FUNCTION public.sync_roles();


--
-- Name: checkins tr_checkin_before_save; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_checkin_before_save BEFORE INSERT OR UPDATE ON public.checkins FOR EACH ROW EXECUTE FUNCTION public.checkin_before_save();


--
-- Name: crm_contacts tr_crm_contact_before_save; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_crm_contact_before_save BEFORE INSERT OR UPDATE ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION public.crm_contact_before_save();


--
-- Name: profiles tr_crm_link_new_profile; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_crm_link_new_profile AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.crm_link_new_profile();


--
-- Name: enrolments tr_crm_on_enrolment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_crm_on_enrolment AFTER INSERT ON public.enrolments FOR EACH ROW EXECUTE FUNCTION public.crm_on_enrolment();


--
-- Name: event_registrations tr_crm_on_registration; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_crm_on_registration AFTER INSERT OR UPDATE OF status ON public.event_registrations FOR EACH ROW EXECUTE FUNCTION public.crm_on_registration();


--
-- Name: event_registrations tr_event_capacity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_event_capacity BEFORE INSERT OR UPDATE OF status ON public.event_registrations FOR EACH ROW EXECUTE FUNCTION public.enforce_event_capacity();


--
-- Name: profiles tr_protect_profile_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_protect_profile_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: batch_invites batch_invites_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_invites
    ADD CONSTRAINT batch_invites_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;


--
-- Name: batch_invites batch_invites_claimed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_invites
    ADD CONSTRAINT batch_invites_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: batch_invites batch_invites_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_invites
    ADD CONSTRAINT batch_invites_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: batches batches_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: batches batches_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: batches batches_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: checkins checkins_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;


--
-- Name: checkins checkins_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: checkins checkins_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: courses courses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: courses courses_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: crm_activities crm_activities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE CASCADE;


--
-- Name: crm_activities crm_activities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: crm_activities crm_activities_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: crm_contacts crm_contacts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contacts
    ADD CONSTRAINT crm_contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: crm_contacts crm_contacts_interest_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contacts
    ADD CONSTRAINT crm_contacts_interest_course_id_fkey FOREIGN KEY (interest_course_id) REFERENCES public.courses(id) ON DELETE SET NULL;


--
-- Name: crm_contacts crm_contacts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contacts
    ADD CONSTRAINT crm_contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: crm_contacts crm_contacts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contacts
    ADD CONSTRAINT crm_contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: crm_contacts crm_contacts_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contacts
    ADD CONSTRAINT crm_contacts_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: enrolments enrolments_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT enrolments_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;


--
-- Name: enrolments enrolments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT enrolments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: enrolments enrolments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT enrolments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: event_registrations event_registrations_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: event_registrations event_registrations_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;


--
-- Name: event_registrations event_registrations_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_registrations event_registrations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: event_registrations event_registrations_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: events events_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE SET NULL;


--
-- Name: events events_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: events events_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_host_id_fkey FOREIGN KEY (host_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: events events_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: followup_records followup_records_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followup_records
    ADD CONSTRAINT followup_records_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;


--
-- Name: followup_records followup_records_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followup_records
    ADD CONSTRAINT followup_records_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: followup_records followup_records_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followup_records
    ADD CONSTRAINT followup_records_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.followup_steps(id) ON DELETE CASCADE;


--
-- Name: followup_records followup_records_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followup_records
    ADD CONSTRAINT followup_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: followup_records followup_records_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followup_records
    ADD CONSTRAINT followup_records_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: followup_steps followup_steps_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followup_steps
    ADD CONSTRAINT followup_steps_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: followup_steps followup_steps_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followup_steps
    ADD CONSTRAINT followup_steps_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: followup_steps followup_steps_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followup_steps
    ADD CONSTRAINT followup_steps_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: lesson_modules lesson_modules_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_modules
    ADD CONSTRAINT lesson_modules_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: lesson_modules lesson_modules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_modules
    ADD CONSTRAINT lesson_modules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: lesson_modules lesson_modules_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_modules
    ADD CONSTRAINT lesson_modules_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: lesson_progress lesson_progress_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_progress
    ADD CONSTRAINT lesson_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE;


--
-- Name: lesson_progress lesson_progress_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_progress
    ADD CONSTRAINT lesson_progress_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: lesson_progress lesson_progress_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_progress
    ADD CONSTRAINT lesson_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: lessons lessons_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: lessons lessons_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;


--
-- Name: lessons lessons_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: lessons lessons_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.lesson_modules(id) ON DELETE CASCADE;


--
-- Name: lessons lessons_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: programme_materials programme_materials_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programme_materials
    ADD CONSTRAINT programme_materials_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: programme_materials programme_materials_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programme_materials
    ADD CONSTRAINT programme_materials_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: programme_materials programme_materials_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programme_materials
    ADD CONSTRAINT programme_materials_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: role_grants role_grants_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_grants
    ADD CONSTRAINT role_grants_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: batch_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.batch_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

--
-- Name: batches batches_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY batches_manage ON public.batches TO authenticated USING (((org_id = public.get_current_user_org_id()) AND (public.is_org_admin() OR ((teacher_id = auth.uid()) AND (public.get_current_user_role() = 'teacher'::text))))) WITH CHECK (((org_id = public.get_current_user_org_id()) AND (public.is_org_admin() OR ((teacher_id = auth.uid()) AND (public.get_current_user_role() = 'teacher'::text)))));


--
-- Name: batches batches_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY batches_select ON public.batches FOR SELECT TO authenticated USING (((org_id = public.get_current_user_org_id()) AND (public.is_org_admin() OR (teacher_id = auth.uid()) OR public.is_enrolled_in_batch(id))));


--
-- Name: checkins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

--
-- Name: checkins checkins_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkins_admin ON public.checkins TO authenticated USING (((org_id = public.get_current_user_org_id()) AND public.is_org_admin())) WITH CHECK (((org_id = public.get_current_user_org_id()) AND public.is_org_admin()));


--
-- Name: checkins checkins_practice_track_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkins_practice_track_only ON public.checkins AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.batch_accepts_checkin(batch_id, day_number));


--
-- Name: checkins checkins_practice_track_only_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkins_practice_track_only_update ON public.checkins AS RESTRICTIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (public.batch_accepts_checkin(batch_id, day_number));


--
-- Name: checkins checkins_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkins_select ON public.checkins FOR SELECT TO authenticated USING (((org_id = public.get_current_user_org_id()) AND ((student_id = auth.uid()) OR public.is_org_admin() OR public.is_batch_teacher(batch_id))));


--
-- Name: checkins checkins_student_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkins_student_insert ON public.checkins FOR INSERT TO authenticated WITH CHECK (((student_id = auth.uid()) AND (org_id = public.get_current_user_org_id()) AND public.is_enrolled_in_batch(batch_id) AND (day_number = public.batch_current_day(batch_id))));


--
-- Name: checkins checkins_student_insert_past; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkins_student_insert_past ON public.checkins FOR INSERT TO authenticated WITH CHECK (((student_id = auth.uid()) AND (org_id = public.get_current_user_org_id()) AND public.is_enrolled_in_batch(batch_id) AND ((day_number >= 1) AND (day_number <= public.batch_current_day(batch_id)))));


--
-- Name: checkins checkins_student_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkins_student_update ON public.checkins FOR UPDATE TO authenticated USING (((student_id = auth.uid()) AND (org_id = public.get_current_user_org_id()) AND (day_number = public.batch_current_day(batch_id)))) WITH CHECK (((student_id = auth.uid()) AND (org_id = public.get_current_user_org_id()) AND public.is_enrolled_in_batch(batch_id) AND (day_number = public.batch_current_day(batch_id))));


--
-- Name: checkins checkins_student_update_past; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checkins_student_update_past ON public.checkins FOR UPDATE TO authenticated USING (((student_id = auth.uid()) AND (org_id = public.get_current_user_org_id()) AND ((day_number >= 1) AND (day_number <= public.batch_current_day(batch_id))))) WITH CHECK (((student_id = auth.uid()) AND (org_id = public.get_current_user_org_id()) AND public.is_enrolled_in_batch(batch_id) AND ((day_number >= 1) AND (day_number <= public.batch_current_day(batch_id)))));


--
-- Name: courses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

--
-- Name: courses courses_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY courses_admin ON public.courses TO authenticated USING (((org_id = public.get_current_user_org_id()) AND public.is_org_admin())) WITH CHECK (((org_id = public.get_current_user_org_id()) AND public.is_org_admin()));


--
-- Name: courses courses_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY courses_select ON public.courses FOR SELECT TO authenticated USING ((org_id = public.get_current_user_org_id()));


--
-- Name: courses courses_teacher_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY courses_teacher_manage ON public.courses TO authenticated USING (((org_id = public.get_current_user_org_id()) AND (public.get_current_user_role() = 'teacher'::text))) WITH CHECK (((org_id = public.get_current_user_org_id()) AND (public.get_current_user_role() = 'teacher'::text)));


--
-- Name: crm_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_activities crm_activities_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_activities_delete_own ON public.crm_activities FOR DELETE TO authenticated USING (((created_by = auth.uid()) AND public.can_manage_contact(contact_id)));


--
-- Name: crm_activities crm_activities_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_activities_insert ON public.crm_activities FOR INSERT TO authenticated WITH CHECK ((public.can_manage_contact(contact_id) AND (created_by = auth.uid()) AND (org_id = public.get_current_user_org_id()) AND (kind <> 'stage'::text)));


--
-- Name: crm_activities crm_activities_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_activities_select ON public.crm_activities FOR SELECT TO authenticated USING (public.can_manage_contact(contact_id));


--
-- Name: crm_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_contacts crm_contacts_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_contacts_staff ON public.crm_contacts TO authenticated USING (((org_id = public.get_current_user_org_id()) AND public.is_org_staff())) WITH CHECK (((org_id = public.get_current_user_org_id()) AND public.is_org_staff()));


--
-- Name: crm_contacts crm_contacts_volunteer_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crm_contacts_volunteer_own ON public.crm_contacts TO authenticated USING (((org_id = public.get_current_user_org_id()) AND public.is_org_crm() AND (owner_id = auth.uid()))) WITH CHECK (((org_id = public.get_current_user_org_id()) AND public.is_org_crm() AND (owner_id = auth.uid())));


--
-- Name: enrolments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enrolments ENABLE ROW LEVEL SECURITY;

--
-- Name: enrolments enrolments_leave; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY enrolments_leave ON public.enrolments FOR DELETE TO authenticated USING ((student_id = auth.uid()));


--
-- Name: enrolments enrolments_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY enrolments_manage ON public.enrolments TO authenticated USING (((org_id = public.get_current_user_org_id()) AND (public.is_org_admin() OR public.is_batch_teacher(batch_id)))) WITH CHECK (((org_id = public.get_current_user_org_id()) AND (public.is_org_admin() OR public.is_batch_teacher(batch_id))));


--
-- Name: enrolments enrolments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY enrolments_select ON public.enrolments FOR SELECT TO authenticated USING (((org_id = public.get_current_user_org_id()) AND ((student_id = auth.uid()) OR public.is_org_admin() OR public.is_batch_teacher(batch_id))));


--
-- Name: event_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: events events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_select ON public.events FOR SELECT TO authenticated USING (((org_id = public.get_current_user_org_id()) AND (published OR public.is_org_staff())));


--
-- Name: events events_staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_staff_manage ON public.events TO authenticated USING (((org_id = public.get_current_user_org_id()) AND public.is_org_staff())) WITH CHECK (((org_id = public.get_current_user_org_id()) AND public.is_org_staff()));


--
-- Name: followup_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.followup_records ENABLE ROW LEVEL SECURITY;

--
-- Name: followup_records followup_records_staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY followup_records_staff_manage ON public.followup_records TO authenticated USING (((org_id = public.get_current_user_org_id()) AND (public.is_org_admin() OR public.is_batch_teacher(batch_id)))) WITH CHECK (((org_id = public.get_current_user_org_id()) AND (public.is_org_admin() OR public.is_batch_teacher(batch_id))));


--
-- Name: followup_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.followup_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: followup_steps followup_steps_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY followup_steps_select ON public.followup_steps FOR SELECT TO authenticated USING ((org_id = public.get_current_user_org_id()));


--
-- Name: followup_steps followup_steps_staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY followup_steps_staff_manage ON public.followup_steps TO authenticated USING (((org_id = public.get_current_user_org_id()) AND public.is_org_staff())) WITH CHECK (((org_id = public.get_current_user_org_id()) AND public.is_org_staff()));


--
-- Name: batch_invites invites_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invites_manage ON public.batch_invites TO authenticated USING (((org_id = public.get_current_user_org_id()) AND (public.is_org_admin() OR public.is_batch_teacher(batch_id)))) WITH CHECK (((org_id = public.get_current_user_org_id()) AND (public.is_org_admin() OR public.is_batch_teacher(batch_id))));


--
-- Name: batch_invites invites_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invites_select_own ON public.batch_invites FOR SELECT TO authenticated USING (((org_id = public.get_current_user_org_id()) AND (lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))));


--
-- Name: lesson_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_modules ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: lessons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

--
-- Name: lessons lessons_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lessons_admin ON public.lessons TO authenticated USING (((org_id = public.get_current_user_org_id()) AND public.is_org_admin())) WITH CHECK (((org_id = public.get_current_user_org_id()) AND public.is_org_admin()));


--
-- Name: lessons lessons_module_unlocked; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lessons_module_unlocked ON public.lessons AS RESTRICTIVE FOR SELECT TO authenticated USING (((module_id IS NULL) OR public.is_org_staff() OR public.module_unlocked_for_me(module_id)));


--
-- Name: lessons lessons_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lessons_select ON public.lessons FOR SELECT TO authenticated USING (((org_id = public.get_current_user_org_id()) AND (public.is_org_admin() OR (author_id = auth.uid()) OR ((scope = 'batch'::text) AND public.is_batch_teacher(batch_id)) OR (published AND ((scope = 'general'::text) OR ((scope = 'course'::text) AND (public.is_enrolled_in_course(course_id) OR public.teaches_course(course_id))) OR ((scope = 'batch'::text) AND public.is_enrolled_in_batch(batch_id)))))));


--
-- Name: lessons lessons_staff_module_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lessons_staff_module_manage ON public.lessons TO authenticated USING (((org_id = public.get_current_user_org_id()) AND public.is_org_staff() AND (module_id IS NOT NULL))) WITH CHECK (((org_id = public.get_current_user_org_id()) AND public.is_org_staff() AND (scope = 'course'::text) AND (module_id IS NOT NULL)));


--
-- Name: lessons lessons_teacher_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lessons_teacher_manage ON public.lessons TO authenticated USING (((org_id = public.get_current_user_org_id()) AND (scope = 'batch'::text) AND public.is_batch_teacher(batch_id))) WITH CHECK (((org_id = public.get_current_user_org_id()) AND (scope = 'batch'::text) AND public.is_batch_teacher(batch_id)));


--
-- Name: programme_materials materials_staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_staff_manage ON public.programme_materials TO authenticated USING (((org_id = public.get_current_user_org_id()) AND public.is_org_staff())) WITH CHECK (((org_id = public.get_current_user_org_id()) AND public.is_org_staff()));


--
-- Name: programme_materials materials_student_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_student_read ON public.programme_materials FOR SELECT TO authenticated USING (((org_id = public.get_current_user_org_id()) AND published AND public.is_enrolled_in_course(course_id)));


--
-- Name: lesson_modules modules_staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_staff_manage ON public.lesson_modules TO authenticated USING (((org_id = public.get_current_user_org_id()) AND public.is_org_staff())) WITH CHECK (((org_id = public.get_current_user_org_id()) AND public.is_org_staff()));


--
-- Name: lesson_modules modules_student_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_student_select ON public.lesson_modules FOR SELECT TO authenticated USING (((org_id = public.get_current_user_org_id()) AND published AND public.is_enrolled_in_course(course_id)));


--
-- Name: organisations org_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_admin_update ON public.organisations FOR UPDATE TO authenticated USING (((id = public.get_current_user_org_id()) AND public.is_org_admin())) WITH CHECK (((id = public.get_current_user_org_id()) AND public.is_org_admin()));


--
-- Name: organisations org_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_read_all ON public.organisations FOR SELECT TO anon, authenticated USING (true);


--
-- Name: organisations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE TO authenticated USING (((org_id = public.get_current_user_org_id()) AND public.is_org_admin())) WITH CHECK ((org_id = public.get_current_user_org_id()));


--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR ((org_id = public.get_current_user_org_id()) AND (public.is_org_admin() OR public.teaches_student(id) OR public.is_my_teacher(id)))));


--
-- Name: profiles profiles_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: programme_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.programme_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_progress progress_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progress_delete_own ON public.lesson_progress FOR DELETE TO authenticated USING ((student_id = auth.uid()));


--
-- Name: lesson_progress progress_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progress_insert_own ON public.lesson_progress FOR INSERT TO authenticated WITH CHECK (((student_id = auth.uid()) AND (org_id = public.get_current_user_org_id()) AND (EXISTS ( SELECT 1
   FROM public.lessons l
  WHERE ((l.id = lesson_progress.lesson_id) AND (l.module_id IS NOT NULL) AND l.published AND public.module_unlocked_for_me(l.module_id))))));


--
-- Name: lesson_progress progress_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progress_select ON public.lesson_progress FOR SELECT TO authenticated USING (((org_id = public.get_current_user_org_id()) AND ((student_id = auth.uid()) OR public.is_org_admin() OR public.teaches_student(student_id))));


--
-- Name: event_registrations registrations_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY registrations_select_own ON public.event_registrations FOR SELECT TO authenticated USING ((profile_id = auth.uid()));


--
-- Name: event_registrations registrations_staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY registrations_staff_manage ON public.event_registrations TO authenticated USING (((org_id = public.get_current_user_org_id()) AND public.is_org_staff())) WITH CHECK (((org_id = public.get_current_user_org_id()) AND public.is_org_staff()));


--
-- Name: role_grants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: role_grants role_grants_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_grants_admin ON public.role_grants TO authenticated USING (((org_id = public.get_current_user_org_id()) AND public.is_org_admin())) WITH CHECK (((org_id = public.get_current_user_org_id()) AND public.is_org_admin()));


--
-- Name: objects avatars_delete_own; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY avatars_delete_own ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- Name: objects avatars_insert_own; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY avatars_insert_own ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- Name: objects avatars_update_own; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY avatars_update_own ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))) WITH CHECK (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- Name: objects materials_delete_staff; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY materials_delete_staff ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'materials'::text) AND public.can_manage_material_path(name)));


--
-- Name: objects materials_insert_staff; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY materials_insert_staff ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'materials'::text) AND public.can_manage_material_path(name)));


--
-- Name: objects materials_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY materials_read ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'materials'::text) AND public.can_read_material_path(name)));


--
-- Name: objects materials_update_staff; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY materials_update_staff ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'materials'::text) AND public.can_manage_material_path(name))) WITH CHECK (((bucket_id = 'materials'::text) AND public.can_manage_material_path(name)));


--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;


--
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO anon;


--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.jwt() TO anon;
GRANT ALL ON FUNCTION auth.jwt() TO authenticated;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.uid() TO anon;
GRANT ALL ON FUNCTION auth.uid() TO authenticated;


--
-- Name: FUNCTION add_batch_invites(p_batch_id uuid, p_emails text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_batch_invites(p_batch_id uuid, p_emails text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_batch_invites(p_batch_id uuid, p_emails text[]) TO authenticated;


--
-- Name: FUNCTION batch_accepts_checkin(p_batch_id uuid, p_day integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.batch_accepts_checkin(p_batch_id uuid, p_day integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.batch_accepts_checkin(p_batch_id uuid, p_day integer) TO authenticated;


--
-- Name: FUNCTION batch_current_day(p_batch_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.batch_current_day(p_batch_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.batch_current_day(p_batch_id uuid) TO authenticated;


--
-- Name: FUNCTION batch_join_preview(p_code text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.batch_join_preview(p_code text) TO anon;
GRANT ALL ON FUNCTION public.batch_join_preview(p_code text) TO authenticated;


--
-- Name: FUNCTION can_manage_contact(p_contact_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_manage_contact(p_contact_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_manage_contact(p_contact_id uuid) TO authenticated;


--
-- Name: FUNCTION can_manage_material_path(p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_manage_material_path(p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_manage_material_path(p_name text) TO authenticated;


--
-- Name: FUNCTION can_read_material_path(p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_read_material_path(p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_read_material_path(p_name text) TO authenticated;


--
-- Name: FUNCTION cancel_my_registration(p_event_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancel_my_registration(p_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancel_my_registration(p_event_id uuid) TO authenticated;


--
-- Name: FUNCTION check_in_to_event(p_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_in_to_event(p_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_in_to_event(p_code text) TO authenticated;


--
-- Name: FUNCTION checkin_before_save(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.checkin_before_save() FROM PUBLIC;


--
-- Name: FUNCTION claim_pending_invites(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_pending_invites() FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_pending_invites() TO authenticated;


--
-- Name: FUNCTION crm_advance(p_contact_id uuid, p_stage text, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crm_advance(p_contact_id uuid, p_stage text, p_note text) FROM PUBLIC;


--
-- Name: FUNCTION crm_contact_before_save(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crm_contact_before_save() FROM PUBLIC;


--
-- Name: FUNCTION crm_funnel_report(p_since date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crm_funnel_report(p_since date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.crm_funnel_report(p_since date) TO authenticated;


--
-- Name: FUNCTION crm_invite_to_event(p_contact_id uuid, p_event_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crm_invite_to_event(p_contact_id uuid, p_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.crm_invite_to_event(p_contact_id uuid, p_event_id uuid) TO authenticated;


--
-- Name: FUNCTION crm_link_new_profile(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crm_link_new_profile() FROM PUBLIC;


--
-- Name: FUNCTION crm_on_enrolment(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crm_on_enrolment() FROM PUBLIC;


--
-- Name: FUNCTION crm_on_registration(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crm_on_registration() FROM PUBLIC;


--
-- Name: FUNCTION crm_open_batches(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crm_open_batches() FROM PUBLIC;
GRANT ALL ON FUNCTION public.crm_open_batches() TO authenticated;


--
-- Name: FUNCTION crm_owners(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crm_owners() FROM PUBLIC;
GRANT ALL ON FUNCTION public.crm_owners() TO authenticated;


--
-- Name: FUNCTION crm_register_for_batch(p_contact_id uuid, p_batch_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crm_register_for_batch(p_contact_id uuid, p_batch_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.crm_register_for_batch(p_contact_id uuid, p_batch_id uuid) TO authenticated;


--
-- Name: FUNCTION delete_user_account(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_user_account() TO authenticated;


--
-- Name: FUNCTION enforce_event_capacity(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_event_capacity() FROM PUBLIC;


--
-- Name: FUNCTION event_checkin_code(p_event_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.event_checkin_code(p_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.event_checkin_code(p_event_id uuid) TO authenticated;


--
-- Name: FUNCTION event_places_taken(p_event_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.event_places_taken(p_event_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.event_places_taken(p_event_ids uuid[]) TO authenticated;


--
-- Name: FUNCTION get_current_user_org_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_current_user_org_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_current_user_org_id() TO authenticated;


--
-- Name: FUNCTION get_current_user_role(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_current_user_role() TO authenticated;


--
-- Name: FUNCTION give_user_consent(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.give_user_consent() FROM PUBLIC;
GRANT ALL ON FUNCTION public.give_user_consent() TO authenticated;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;


--
-- Name: FUNCTION is_batch_teacher(p_batch_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_batch_teacher(p_batch_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_batch_teacher(p_batch_id uuid) TO authenticated;


--
-- Name: FUNCTION is_enrolled_in_batch(p_batch_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_enrolled_in_batch(p_batch_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_enrolled_in_batch(p_batch_id uuid) TO authenticated;


--
-- Name: FUNCTION is_enrolled_in_course(p_course_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_enrolled_in_course(p_course_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_enrolled_in_course(p_course_id uuid) TO authenticated;


--
-- Name: FUNCTION is_my_teacher(p_profile_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_my_teacher(p_profile_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_my_teacher(p_profile_id uuid) TO authenticated;


--
-- Name: FUNCTION is_org_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_org_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_org_admin() TO authenticated;


--
-- Name: FUNCTION is_org_crm(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_org_crm() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_org_crm() TO authenticated;


--
-- Name: FUNCTION is_org_staff(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_org_staff() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_org_staff() TO authenticated;


--
-- Name: FUNCTION join_batch_by_code(p_join_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.join_batch_by_code(p_join_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.join_batch_by_code(p_join_code text) TO authenticated;


--
-- Name: FUNCTION module_unlocked_for_me(p_module_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.module_unlocked_for_me(p_module_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.module_unlocked_for_me(p_module_id uuid) TO authenticated;


--
-- Name: FUNCTION my_batch_sessions(p_batch_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_batch_sessions(p_batch_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_batch_sessions(p_batch_id uuid) TO authenticated;


--
-- Name: FUNCTION my_module_complete(p_module_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_module_complete(p_module_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_module_complete(p_module_id uuid) TO authenticated;


--
-- Name: FUNCTION my_programme_day(p_course_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_programme_day(p_course_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_programme_day(p_course_id uuid) TO authenticated;


--
-- Name: FUNCTION protect_profile_fields(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.protect_profile_fields() FROM PUBLIC;


--
-- Name: FUNCTION register_for_event(p_event_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.register_for_event(p_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.register_for_event(p_event_id uuid) TO authenticated;


--
-- Name: FUNCTION sync_my_google_avatar(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_my_google_avatar() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_my_google_avatar() TO authenticated;


--
-- Name: FUNCTION teaches_course(p_course_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.teaches_course(p_course_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.teaches_course(p_course_id uuid) TO authenticated;


--
-- Name: FUNCTION teaches_student(p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.teaches_student(p_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.teaches_student(p_student_id uuid) TO authenticated;


--
-- Name: TABLE batch_invites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.batch_invites TO anon;
GRANT ALL ON TABLE public.batch_invites TO authenticated;


--
-- Name: TABLE batches; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.batches TO anon;
GRANT ALL ON TABLE public.batches TO authenticated;


--
-- Name: TABLE checkins; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.checkins TO anon;
GRANT ALL ON TABLE public.checkins TO authenticated;


--
-- Name: TABLE courses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.courses TO anon;
GRANT ALL ON TABLE public.courses TO authenticated;


--
-- Name: TABLE crm_activities; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.crm_activities TO anon;
GRANT ALL ON TABLE public.crm_activities TO authenticated;


--
-- Name: TABLE crm_contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.crm_contacts TO anon;
GRANT ALL ON TABLE public.crm_contacts TO authenticated;


--
-- Name: TABLE enrolments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.enrolments TO anon;
GRANT ALL ON TABLE public.enrolments TO authenticated;


--
-- Name: TABLE event_registrations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.event_registrations TO anon;
GRANT ALL ON TABLE public.event_registrations TO authenticated;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.events TO anon;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.org_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(org_id) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.kind; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(kind) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.title; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(title) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.description; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(description) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.starts_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(starts_at) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.ends_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(ends_at) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.venue; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(venue) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.online_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(online_url) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.capacity; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(capacity) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.course_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(course_id) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.batch_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(batch_id) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.host_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(host_id) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.published; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(published) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.created_by; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_by) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.events TO authenticated;


--
-- Name: COLUMN events.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(updated_at) ON TABLE public.events TO authenticated;


--
-- Name: TABLE followup_records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.followup_records TO anon;
GRANT ALL ON TABLE public.followup_records TO authenticated;


--
-- Name: TABLE followup_steps; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.followup_steps TO anon;
GRANT ALL ON TABLE public.followup_steps TO authenticated;


--
-- Name: TABLE lesson_modules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lesson_modules TO anon;
GRANT ALL ON TABLE public.lesson_modules TO authenticated;


--
-- Name: TABLE lesson_progress; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lesson_progress TO anon;
GRANT ALL ON TABLE public.lesson_progress TO authenticated;


--
-- Name: TABLE lessons; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lessons TO anon;
GRANT ALL ON TABLE public.lessons TO authenticated;


--
-- Name: TABLE organisations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organisations TO anon;
GRANT ALL ON TABLE public.organisations TO authenticated;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.roles; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(roles) ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE programme_materials; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.programme_materials TO anon;
GRANT ALL ON TABLE public.programme_materials TO authenticated;


--
-- Name: TABLE role_grants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.role_grants TO anon;
GRANT ALL ON TABLE public.role_grants TO authenticated;


--
-- Name: TABLE buckets; Type: ACL; Schema: storage; Owner: -
--

GRANT SELECT ON TABLE storage.buckets TO authenticated;
GRANT SELECT ON TABLE storage.buckets TO anon;


--
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE storage.objects TO authenticated;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;


--
-- PostgreSQL database dump complete
--

\unrestrict nJBxQdjBh2IJmzn0fwrexl35v6ec2gfmrQwRreBC0WsGbtWwWUW2YpcLciRazaQ

