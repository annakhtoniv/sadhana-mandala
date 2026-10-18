-- ============================================================================
-- Sadhana Mandala: Phase 14 migration (data safety)
--
-- Fixes from the stress test and expert review of 2026-10-18 (PM approved):
--  1. Teachers can no longer delete programmes or change programmes they did
--     not create; only admins delete. A programme that has batches, and a
--     batch that has check-ins, can no longer be deleted at all (no more
--     cascading deletes of practice history).
--  2. Delete my account: refused while the person still teaches a batch, and
--     for the last admin of the organisation. It now also removes the
--     person's own lead record and guest registrations (privacy, PDPL).
--     The app removes their profile photos first.
--  3. An organisation always keeps at least one admin (also when two admins
--     change each other's roles at the same moment).
--  4. Volunteers: adding a lead no longer reveals whether that email has an
--     account, and registering a lead for a batch no longer enrols an
--     existing member directly (they get the join link instead).
--  5. Teachers see only their own leads, and only the guest lists of events
--     they host or created. Admins still see everything.
--  6. Students can open only published study files.
--  7. People can change only their name and photo on their own profile
--     (consent date and other fields are written by the app's functions
--     only). Every consent is recorded in a consent log.
--  8. Join codes: new codes are 8 random characters; joining is limited to
--     10 wrong codes per 15 minutes per person; the sign-in preview can be
--     limited to the site's organisation.
--  9. New members who sign in on another organisation's site move to that
--     organisation (Prana Flow sign-ups no longer land in Sadhana Mandala).
-- 10. Checks: lesson video links must be https, study-file paths must sit in
--     their programme's folder, profile photos only from this project, names
--     up to 100 characters, a valid time zone, students only in batches of
--     their own organisation, no SVG uploads, 20 MB per study file.
-- 11. Tables: no TRUNCATE / REFERENCES / TRIGGER rights for app users, and
--     visitors who are not signed in can read only the organisations table.
--
-- Safe to run more than once. Run after supabase/phase13_roles.sql, then
-- seed_dummy_data.sql, then verify.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
create or replace function public.crm_stage_rank(p_stage text)
returns integer language sql immutable set search_path = public as $$
  select case p_stage
    when 'new' then 0 when 'invited' then 1 when 'attended' then 2 when 'interested' then 3
    when 'registered' then 4 when 'completed' then 5 else -1 end;
$$;

-- Organisation of any profile (for checks that must not depend on who can see it)
create or replace function public.profile_org(p_profile_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = p_profile_id;
$$;

-- The caller hosts or created this event
create or replace function public.is_event_host(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events e
                 where e.id = p_event_id and (e.host_id = auth.uid() or e.created_by = auth.uid()));
$$;

-- 8 characters from an alphabet without look-alikes (no 0/O, 1/I), cryptographic randomness
create or replace function public.new_join_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := uuid_send(gen_random_uuid());
  v_code text := '';
  i int;
begin
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

revoke execute on function public.profile_org(uuid), public.is_event_host(uuid) from public, anon;
grant execute on function public.profile_org(uuid), public.is_event_host(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 1. No cascading loss of practice history
-- ----------------------------------------------------------------------------
do $$
begin
  -- programme -> batches: a programme with batches cannot be deleted
  alter table public.batches drop constraint if exists batches_course_id_fkey;
  alter table public.batches add constraint batches_course_id_fkey
    foreign key (course_id) references public.courses(id) on delete restrict;
  -- teacher -> batches: a teacher with batches cannot be deleted
  alter table public.batches drop constraint if exists batches_teacher_id_fkey;
  alter table public.batches add constraint batches_teacher_id_fkey
    foreign key (teacher_id) references public.profiles(id) on delete restrict;
  -- batch -> check-ins: a batch with check-ins cannot be deleted
  alter table public.checkins drop constraint if exists checkins_batch_id_fkey;
  alter table public.checkins add constraint checkins_batch_id_fkey
    foreign key (batch_id) references public.batches(id) on delete restrict;
end $$;

-- Programmes: teachers add programmes and change the ones they created; only admins delete
drop policy if exists "courses_teacher_manage" on public.courses;
drop policy if exists "courses_teacher_insert" on public.courses;
drop policy if exists "courses_teacher_update" on public.courses;
create policy "courses_teacher_insert" on public.courses
  for insert to authenticated
  with check (org_id = public.get_current_user_org_id() and public.is_org_staff() and created_by = auth.uid());
create policy "courses_teacher_update" on public.courses
  for update to authenticated
  using (org_id = public.get_current_user_org_id() and public.is_org_staff() and created_by = auth.uid())
  with check (org_id = public.get_current_user_org_id() and public.is_org_staff() and created_by = auth.uid());

-- Check-ins: the app now saves only the tile that was tapped (Morning or
-- Evening), so a tick made on another device is never overwritten. The
-- status column follows the ticks (trigger), so it gets a default.
alter table public.checkins alter column status set default 'not_yet';

-- ----------------------------------------------------------------------------
-- 2 + 3. Account deletion and "at least one admin"
-- ----------------------------------------------------------------------------
-- Raises when removing p_profile_id's admin role would leave its organisation without an admin
create or replace function public.ensure_another_admin(p_org_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- one change at a time per organisation, so two admins cannot remove each other together
  perform pg_advisory_xact_lock(hashtext('admins:' || p_org_id::text));
  if not exists (select 1 from public.profiles
                 where org_id = p_org_id and id <> p_profile_id and 'admin' = any(roles)) then
    raise exception 'The organisation needs at least one admin. Make someone else admin first.';
  end if;
end;
$$;
revoke execute on function public.ensure_another_admin(uuid, uuid) from public, anon, authenticated;

create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only client sessions are restricted; SQL editor and seed scripts run without auth.uid()
  if auth.uid() is not null then
    if new.org_id is distinct from old.org_id
       and coalesce(current_setting('app.allow_org_move', true), '') <> 'on' then
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
  -- Never leave an organisation without an admin
  if 'admin' = any(old.roles) and not ('admin' = any(new.roles)) then
    perform public.ensure_another_admin(old.org_id, old.id);
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.delete_user_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  select * into v_profile from public.profiles where id = v_user_id;
  if exists (select 1 from public.batches where teacher_id = v_user_id) then
    raise exception 'You still teach one or more batches. Ask an admin to give them to another teacher first.';
  end if;
  if v_profile.id is not null and 'admin' = any(v_profile.roles) then
    perform public.ensure_another_admin(v_profile.org_id, v_user_id);
  end if;
  -- Personal data held elsewhere: the lead record about this person and guest registrations by email
  delete from public.crm_contacts where profile_id = v_user_id;
  if v_profile.email is not null then
    delete from public.crm_contacts where org_id = v_profile.org_id and lower(email) = lower(v_profile.email);
    delete from public.event_registrations
    where org_id = v_profile.org_id and profile_id is null and lower(guest_email) = lower(v_profile.email);
  end if;
  update public.batch_invites set claimed_by = null where claimed_by = v_user_id;
  delete from public.profiles where id = v_user_id;
  delete from auth.users where id = v_user_id;
end;
$$;

-- People may list (and so remove) their own photos; needed to delete them with their account
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_select_own') then
    create policy "avatars_select_own" on storage.objects
      for select to authenticated
      using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Volunteers and existing accounts
-- ----------------------------------------------------------------------------
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
    -- Link to an existing account with the same email: staff and system only, so a
    -- volunteer cannot use a new lead to find out whether an email has an account
    if new.profile_id is null and new.email is not null
       and (auth.uid() is null or pg_trigger_depth() > 1 or public.is_org_staff()) then
      select id into new.profile_id from public.profiles
      where org_id = new.org_id and lower(email) = new.email limit 1;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.crm_register_for_batch(p_contact_id uuid, p_batch_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  c record;
  b record;
  v_has_account boolean;
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

  v_has_account := c.profile_id is not null
    or (c.email is not null and exists (select 1 from public.profiles p
                                        where p.org_id = c.org_id and lower(p.email) = c.email));

  if v_has_account and not public.is_org_staff() then
    -- A member chooses their own batch: send them the link instead of enrolling them
    return json_build_object('success', false,
      'message', 'Send them the batch link so they can join themselves.',
      'join_code', b.join_code);
  end if;

  if c.profile_id is not null then
    insert into public.enrolments (org_id, batch_id, student_id, source)
    values (c.org_id, b.id, c.profile_id, 'invite')
    on conflict (batch_id, student_id) do nothing;
  elsif c.email is not null and not v_has_account then
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

-- ----------------------------------------------------------------------------
-- 5. Teachers: own leads and own events' guests only
-- ----------------------------------------------------------------------------
create or replace function public.can_manage_contact(p_contact_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crm_contacts c
    where c.id = p_contact_id
      and c.org_id = public.get_current_user_org_id()
      and (public.is_org_admin() or (public.is_org_crm() and c.owner_id = auth.uid()))
  );
$$;

drop policy if exists "crm_contacts_staff" on public.crm_contacts;
drop policy if exists "crm_contacts_admin" on public.crm_contacts;
create policy "crm_contacts_admin" on public.crm_contacts
  for all to authenticated
  using (org_id = public.get_current_user_org_id() and public.is_org_admin())
  with check (org_id = public.get_current_user_org_id() and public.is_org_admin());

drop policy if exists "registrations_staff_manage" on public.event_registrations;
drop policy if exists "registrations_staff_host_manage" on public.event_registrations;
create policy "registrations_staff_host_manage" on public.event_registrations
  for all to authenticated
  using (org_id = public.get_current_user_org_id() and public.is_org_staff()
         and (public.is_org_admin() or public.is_event_host(event_id)))
  with check (org_id = public.get_current_user_org_id() and public.is_org_staff()
              and (public.is_org_admin() or public.is_event_host(event_id)));

-- ----------------------------------------------------------------------------
-- 6. Hidden study files stay hidden
-- ----------------------------------------------------------------------------
create or replace function public.can_read_material_path(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select split_part(p_name, '/', 1) = public.get_current_user_org_id()::text
     and (
       public.is_org_staff()
       or (
         exists (select 1 from public.enrolments e
                 join public.batches b on b.id = e.batch_id
                 where e.student_id = auth.uid() and b.course_id::text = split_part(p_name, '/', 2))
         and exists (select 1 from public.programme_materials m
                     where m.storage_path = p_name and m.published)
       )
     );
$$;

-- ----------------------------------------------------------------------------
-- 7. Profiles: only name and photo by the person; consent log
-- ----------------------------------------------------------------------------
revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, avatar_source, roles) on public.profiles to authenticated;

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  notice_version text not null,
  consented_at timestamptz not null default now()
);
create index if not exists consent_events_profile_idx on public.consent_events (profile_id);
alter table public.consent_events enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'consent_events' and policyname = 'consent_events_read') then
    create policy "consent_events_read" on public.consent_events
      for select to authenticated
      using (profile_id = auth.uid() or (org_id = public.get_current_user_org_id() and public.is_org_admin()));
  end if;
end $$;
revoke all on public.consent_events from anon;
revoke insert, update, delete, truncate on public.consent_events from authenticated;

-- Consent is written here only; every consent is kept in the log
create or replace function public.give_user_consent(p_notice_version text default 'v2-2026-10')
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.profiles set consent_at = v_now where id = auth.uid() returning org_id into v_org;
  if v_org is null then
    raise exception 'Profile not found';
  end if;
  insert into public.consent_events (org_id, profile_id, notice_version, consented_at)
  values (v_org, auth.uid(), left(coalesce(p_notice_version, 'v2-2026-10'), 40), v_now);
  return v_now;
end;
$$;
revoke execute on function public.give_user_consent(text) from public, anon;
grant execute on function public.give_user_consent(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. Join codes
-- ----------------------------------------------------------------------------
alter table public.batches alter column join_code set default public.new_join_code();
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'batches_join_code_format') then
    alter table public.batches add constraint batches_join_code_format
      check (join_code ~ '^[A-Z0-9]{4,12}$') not valid;
  end if;
end $$;

create table if not exists public.join_attempts (
  user_id uuid not null,
  attempted_at timestamptz not null default now()
);
create index if not exists join_attempts_user_idx on public.join_attempts (user_id, attempted_at);
alter table public.join_attempts enable row level security;
revoke all on public.join_attempts from anon, authenticated;

create or replace function public.join_batch_by_code(p_join_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid := public.get_current_user_org_id();
  v_batch record;
  v_enrolment_id uuid;
begin
  if v_user_id is null or v_org_id is null then
    return json_build_object('success', false, 'message', 'Please sign in first.');
  end if;

  -- At most 10 wrong codes per 15 minutes per person
  if (select count(*) from public.join_attempts
      where user_id = v_user_id and attempted_at > now() - interval '15 minutes') >= 10 then
    return json_build_object('success', false, 'message', 'Too many wrong codes. Please wait 15 minutes and try again.');
  end if;

  -- A join code works only inside its own organisation
  select b.id, b.org_id, b.name into v_batch
  from public.batches b
  where upper(b.join_code) = upper(trim(p_join_code))
    and b.org_id = v_org_id
  limit 1;

  if v_batch.id is null then
    insert into public.join_attempts (user_id) values (v_user_id);
    delete from public.join_attempts where attempted_at < now() - interval '1 day';
    return json_build_object('success', false, 'message', 'Invalid join code. Please check with your teacher.');
  end if;

  insert into public.enrolments (org_id, batch_id, student_id, source)
  values (v_batch.org_id, v_batch.id, v_user_id, 'code')
  on conflict (batch_id, student_id) do update set joined_at = public.enrolments.joined_at
  returning id into v_enrolment_id;

  return json_build_object('success', true, 'batch_name', v_batch.name, 'enrolment_id', v_enrolment_id);
end;
$$;

-- Sign-in preview of a join link, limited to the site's organisation when given
create or replace function public.batch_join_preview(p_code text, p_org_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'batch_name', b.name, 'course_name', c.name, 'start_date', b.start_date,
    'org_name', o.name, 'org_slug', o.slug)
  from public.batches b
  join public.courses c on c.id = b.course_id
  join public.organisations o on o.id = b.org_id
  where upper(b.join_code) = upper(trim(p_code))
    and (p_org_slug is null or o.slug = p_org_slug)
  limit 1;
$$;
grant execute on function public.batch_join_preview(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. New members join the organisation of the site they signed in on
-- ----------------------------------------------------------------------------
create or replace function public.adopt_site_organisation(p_org_slug text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_target uuid;
  p record;
begin
  if v_user is null then return false; end if;
  select id into v_target from public.organisations where slug = p_org_slug;
  select * into p from public.profiles where id = v_user;
  if v_target is null or p.id is null or p.org_id = v_target then return false; end if;
  -- Only brand-new members with nothing in their current organisation yet
  if p.created_at < now() - interval '1 day' or p.roles <> array['student']
     or exists (select 1 from public.enrolments where student_id = v_user)
     or exists (select 1 from public.checkins where student_id = v_user)
     or exists (select 1 from public.role_grants where org_id = p.org_id and lower(email) = lower(p.email)) then
    return false;
  end if;
  perform set_config('app.allow_org_move', 'on', true);
  update public.profiles set org_id = v_target where id = v_user;
  perform set_config('app.allow_org_move', '', true);
  -- Roles waiting for this email in the new organisation
  update public.profiles p2 set roles = g.roles
  from public.role_grants g
  where p2.id = v_user and g.org_id = v_target and lower(g.email) = lower(p.email);
  return true;
end;
$$;
revoke execute on function public.adopt_site_organisation(text) from public, anon;
grant execute on function public.adopt_site_organisation(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 10. Checks
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lessons_video_url_https') then
    alter table public.lessons add constraint lessons_video_url_https
      check (video_url is null or video_url = '' or video_url ~* '^https://') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'programme_materials_path_in_folder') then
    alter table public.programme_materials add constraint programme_materials_path_in_folder
      check (storage_path is null or storage_path like org_id::text || '/' || course_id::text || '/%') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_full_name_length') then
    alter table public.profiles add constraint profiles_full_name_length
      check (full_name is null or char_length(full_name) <= 100) not valid;
  end if;
  -- Profile photos: Google, or this project's own avatars bucket only
  alter table public.profiles drop constraint if exists profiles_avatar_url_check;
  alter table public.profiles add constraint profiles_avatar_url_check check (
    avatar_url is null
    or avatar_url ~ '^https://lh[0-9]+\.googleusercontent\.com/'
    or avatar_url ~ '^https://pshapxojprvgmwhdivim\.supabase\.co/storage/v1/object/public/avatars/'
  ) not valid;
end $$;

-- Time zone must be one Postgres knows (a wrong one would stop every check-in)
create or replace function public.check_org_timezone()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown time zone: %', new.timezone;
  end if;
  return new;
end;
$$;
drop trigger if exists tr_check_org_timezone on public.organisations;
create trigger tr_check_org_timezone before insert or update of timezone on public.organisations
  for each row execute function public.check_org_timezone();

-- Students only in batches of their own organisation
drop policy if exists "enrolments_same_org" on public.enrolments;
create policy "enrolments_same_org" on public.enrolments
  as restrictive for insert to authenticated
  with check (public.profile_org(student_id) = org_id);

-- Study files: no SVG (it can carry scripts), 20 MB each
update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf', 'audio/*', 'video/*', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain']
where id = 'materials';

-- ----------------------------------------------------------------------------
-- 11. Table rights
-- ----------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', t.tablename);
    if t.tablename <> 'organisations' then
      execute format('revoke all on public.%I from anon', t.tablename);
    end if;
  end loop;
end $$;
grant select on public.organisations to anon;
