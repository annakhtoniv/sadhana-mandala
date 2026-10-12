-- ============================================================================
-- Sadhana Mandala: Phase 4 security migration
--
-- Replaces every row level security policy in the public schema with one
-- clean, non-recursive set that follows the "Access rules" in SPEC.md.
--
-- Fixes found during the Phase 4 review (2026-10-11):
--   * Policies on batches / enrolments / profiles referenced each other and
--     failed with "infinite recursion detected in policy" for every signed-in
--     user, so the app silently showed mock data instead of the database.
--   * Any user could make themselves admin (set_my_role RPC, or a direct
--     update of profiles.role) or move into another organisation by updating
--     profiles.org_id.
--   * Inside an organisation every user could read and write every check-in,
--     batch, invite and role grant.
--   * Join codes worked across organisations.
--
-- Safe to run more than once. Run it in the Supabase SQL editor, then run
-- supabase/seed_dummy_data.sql, then supabase/phase4_verify.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper functions (security definer, so policies never recurse)
-- ----------------------------------------------------------------------------
create or replace function public.get_current_user_org_id()
returns uuid language sql security definer stable set search_path = public as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.get_current_user_role()
returns text language sql security definer stable set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_org_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- Caller teaches this batch (and it is in the caller's organisation)
create or replace function public.is_batch_teacher(p_batch_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.batches b
    where b.id = p_batch_id
      and b.teacher_id = auth.uid()
      and b.org_id = public.get_current_user_org_id()
  );
$$;

-- Caller is enrolled in this batch
create or replace function public.is_enrolled_in_batch(p_batch_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.enrolments e
    where e.batch_id = p_batch_id and e.student_id = auth.uid()
  );
$$;

-- Caller is enrolled in a batch of this course
create or replace function public.is_enrolled_in_course(p_course_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.enrolments e
    join public.batches b on b.id = e.batch_id
    where b.course_id = p_course_id and e.student_id = auth.uid()
  );
$$;

-- Caller teaches a batch of this course
create or replace function public.teaches_course(p_course_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.batches b
    where b.course_id = p_course_id and b.teacher_id = auth.uid()
  );
$$;

-- Caller teaches a batch this student is enrolled in
create or replace function public.teaches_student(p_student_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.enrolments e
    join public.batches b on b.id = e.batch_id
    where e.student_id = p_student_id and b.teacher_id = auth.uid()
  );
$$;

-- This profile is the teacher of a batch the caller is enrolled in
create or replace function public.is_my_teacher(p_profile_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.enrolments e
    join public.batches b on b.id = e.batch_id
    where e.student_id = auth.uid() and b.teacher_id = p_profile_id
  );
$$;

-- Today's day number for a batch, in the organisation timezone (Day 1 = start_date)
create or replace function public.batch_current_day(p_batch_id uuid)
returns integer language sql security definer stable set search_path = public as $$
  select ((now() at time zone coalesce(o.timezone, 'Asia/Dubai'))::date - b.start_date) + 1
  from public.batches b
  join public.organisations o on o.id = b.org_id
  where b.id = p_batch_id;
$$;

-- ----------------------------------------------------------------------------
-- 2. Profile protection: a user can never change their own role or organisation
-- ----------------------------------------------------------------------------
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
    if new.role is distinct from old.role then
      if new.id = auth.uid() then
        raise exception 'Cannot change your own role';
      end if;
      if not public.is_org_admin() or old.org_id <> public.get_current_user_org_id() then
        raise exception 'Only an admin of this organisation can change roles';
      end if;
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_protect_profile_fields on public.profiles;
create trigger tr_protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ----------------------------------------------------------------------------
-- 3. RPCs
-- ----------------------------------------------------------------------------
-- Self-service role switching is not allowed (SPEC: "A user can never change
-- their own role or organisation"). Roles come from role_grants or an admin.
drop function if exists public.set_my_role(text);

create or replace function public.give_user_consent()
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
begin
  update public.profiles set consent_at = v_now where id = auth.uid();
  return v_now;
end;
$$;

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

-- Delete my account: remove profile (enrolments and check-ins cascade) and the sign-in account
create or replace function public.delete_user_account()
returns void language plpgsql security definer set search_path = public as $$
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

-- Lock down function execution: nothing for anonymous visitors
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.get_current_user_org_id(), public.get_current_user_role(), public.is_org_admin(),
  public.is_batch_teacher(uuid), public.is_enrolled_in_batch(uuid), public.is_enrolled_in_course(uuid),
  public.teaches_course(uuid), public.teaches_student(uuid), public.is_my_teacher(uuid),
  public.batch_current_day(uuid), public.give_user_consent(), public.join_batch_by_code(text),
  public.claim_pending_invites(), public.add_batch_invites(uuid, text[]), public.delete_user_account()
to authenticated;
revoke execute on function public.handle_new_user(), public.protect_profile_fields() from authenticated;

-- ----------------------------------------------------------------------------
-- 4. Drop every existing policy in public, then recreate
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.organisations enable row level security;
alter table public.profiles      enable row level security;
alter table public.role_grants   enable row level security;
alter table public.courses       enable row level security;
alter table public.batches       enable row level security;
alter table public.batch_invites enable row level security;
alter table public.enrolments    enable row level security;
alter table public.checkins      enable row level security;
alter table public.lessons       enable row level security;

-- organisations: branding is public (needed before sign-in); only admins edit their own
create policy "org_read_all" on public.organisations
  for select to anon, authenticated using (true);
create policy "org_admin_update" on public.organisations
  for update to authenticated
  using (id = public.get_current_user_org_id() and public.is_org_admin())
  with check (id = public.get_current_user_org_id() and public.is_org_admin());

-- profiles (rows are created by the handle_new_user trigger, never by the client)
create policy "profiles_select" on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or (org_id = public.get_current_user_org_id() and (
      public.is_org_admin() or public.teaches_student(id) or public.is_my_teacher(id)
    ))
  );
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_admin_update" on public.profiles
  for update to authenticated
  using (org_id = public.get_current_user_org_id() and public.is_org_admin())
  with check (org_id = public.get_current_user_org_id());

-- role_grants: admins only
create policy "role_grants_admin" on public.role_grants
  for all to authenticated
  using (org_id = public.get_current_user_org_id() and public.is_org_admin())
  with check (org_id = public.get_current_user_org_id() and public.is_org_admin());

-- courses: everyone in the org reads, admins manage
create policy "courses_select" on public.courses
  for select to authenticated using (org_id = public.get_current_user_org_id());
create policy "courses_admin" on public.courses
  for all to authenticated
  using (org_id = public.get_current_user_org_id() and public.is_org_admin())
  with check (org_id = public.get_current_user_org_id() and public.is_org_admin());

-- batches: teacher controls own, student reads enrolled, admin everything in org
create policy "batches_select" on public.batches
  for select to authenticated using (
    org_id = public.get_current_user_org_id()
    and (public.is_org_admin() or teacher_id = auth.uid() or public.is_enrolled_in_batch(id))
  );
create policy "batches_manage" on public.batches
  for all to authenticated
  using (
    org_id = public.get_current_user_org_id()
    and (public.is_org_admin() or (teacher_id = auth.uid() and public.get_current_user_role() = 'teacher'))
  )
  with check (
    org_id = public.get_current_user_org_id()
    and (public.is_org_admin() or (teacher_id = auth.uid() and public.get_current_user_role() = 'teacher'))
  );

-- batch_invites: batch teacher and admin manage; a student sees invites to own email
create policy "invites_manage" on public.batch_invites
  for all to authenticated
  using (org_id = public.get_current_user_org_id() and (public.is_org_admin() or public.is_batch_teacher(batch_id)))
  with check (org_id = public.get_current_user_org_id() and (public.is_org_admin() or public.is_batch_teacher(batch_id)));
create policy "invites_select_own" on public.batch_invites
  for select to authenticated using (
    org_id = public.get_current_user_org_id()
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- enrolments: student reads own and may leave; teacher reads/manages own batches; admin all
create policy "enrolments_select" on public.enrolments
  for select to authenticated using (
    org_id = public.get_current_user_org_id()
    and (student_id = auth.uid() or public.is_org_admin() or public.is_batch_teacher(batch_id))
  );
create policy "enrolments_manage" on public.enrolments
  for all to authenticated
  using (org_id = public.get_current_user_org_id() and (public.is_org_admin() or public.is_batch_teacher(batch_id)))
  with check (org_id = public.get_current_user_org_id() and (public.is_org_admin() or public.is_batch_teacher(batch_id)));
create policy "enrolments_leave" on public.enrolments
  for delete to authenticated using (student_id = auth.uid());

-- checkins: student reads and writes own, for today only; teacher reads own batches; admin all
create policy "checkins_select" on public.checkins
  for select to authenticated using (
    org_id = public.get_current_user_org_id()
    and (student_id = auth.uid() or public.is_org_admin() or public.is_batch_teacher(batch_id))
  );
create policy "checkins_student_insert" on public.checkins
  for insert to authenticated with check (
    student_id = auth.uid()
    and org_id = public.get_current_user_org_id()
    and public.is_enrolled_in_batch(batch_id)
    and day_number = public.batch_current_day(batch_id)
  );
create policy "checkins_student_update" on public.checkins
  for update to authenticated
  using (student_id = auth.uid() and org_id = public.get_current_user_org_id()
         and day_number = public.batch_current_day(batch_id))
  with check (student_id = auth.uid() and org_id = public.get_current_user_org_id()
              and public.is_enrolled_in_batch(batch_id)
              and day_number = public.batch_current_day(batch_id));
create policy "checkins_admin" on public.checkins
  for all to authenticated
  using (org_id = public.get_current_user_org_id() and public.is_org_admin())
  with check (org_id = public.get_current_user_org_id() and public.is_org_admin());

-- lessons: published lessons by scope; teacher controls own batch lessons; admin all
create policy "lessons_select" on public.lessons
  for select to authenticated using (
    org_id = public.get_current_user_org_id()
    and (
      public.is_org_admin()
      or author_id = auth.uid()
      or (scope = 'batch' and public.is_batch_teacher(batch_id))
      or (published and (
        scope = 'general'
        or (scope = 'course' and (public.is_enrolled_in_course(course_id) or public.teaches_course(course_id)))
        or (scope = 'batch' and public.is_enrolled_in_batch(batch_id))
      ))
    )
  );
create policy "lessons_teacher_manage" on public.lessons
  for all to authenticated
  using (org_id = public.get_current_user_org_id() and scope = 'batch' and public.is_batch_teacher(batch_id))
  with check (org_id = public.get_current_user_org_id() and scope = 'batch' and public.is_batch_teacher(batch_id));
create policy "lessons_admin" on public.lessons
  for all to authenticated
  using (org_id = public.get_current_user_org_id() and public.is_org_admin())
  with check (org_id = public.get_current_user_org_id() and public.is_org_admin());
