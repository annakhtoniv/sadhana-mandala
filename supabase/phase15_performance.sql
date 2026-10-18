-- ============================================================================
-- Sadhana Mandala: Phase 15 migration (speed)
--
-- From the stress test of 2026-10-18 (PM approved): with a year of data the
-- teacher's batch screen took 174 ms per request because every access rule
-- asked "who is this user?" again for every row. Rewritten the way Supabase
-- recommends, the same request takes about 3 ms.
--
--  1. Helper lists (computed once per request): the batches I teach, the
--     batches and programmes I am enrolled in, my students, my teachers, the
--     programmes I teach, the leads I may manage, the events I host.
--  2. Every access rule rewritten with the same meaning: "(select fn())" so a
--     check runs once per request, and "x in (select my_list())" instead of a
--     per-row lookup. Rules now apply to signed-in users only ("to
--     authenticated"); visitors who are not signed in only read the
--     organisation name (Phase 14).
--  3. Indexes for the lookups the app and the rules make.
--  4. A small table where the app reports errors people run into (admins
--     read them), so problems are noticed without anyone telling us.
--
-- Same rules as before, so verify.sql must still say PASS everywhere.
-- Safe to run more than once. Run after supabase/phase14_safety.sql, then
-- verify.sql. (No new sample data, so no seed is needed.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper lists (same logic as the per-row helpers they replace in the rules)
-- ----------------------------------------------------------------------------
create or replace function public.my_teaching_batch_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select b.id from public.batches b
  where b.teacher_id = auth.uid() and b.org_id = public.get_current_user_org_id();
$$;

create or replace function public.my_enrolled_batch_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select e.batch_id from public.enrolments e where e.student_id = auth.uid();
$$;

create or replace function public.my_enrolled_course_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct b.course_id from public.enrolments e
  join public.batches b on b.id = e.batch_id
  where e.student_id = auth.uid();
$$;

create or replace function public.my_student_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct e.student_id from public.enrolments e
  join public.batches b on b.id = e.batch_id
  where b.teacher_id = auth.uid();
$$;

create or replace function public.my_teacher_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct b.teacher_id from public.enrolments e
  join public.batches b on b.id = e.batch_id
  where e.student_id = auth.uid();
$$;

create or replace function public.my_taught_course_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct b.course_id from public.batches b where b.teacher_id = auth.uid();
$$;

create or replace function public.my_manageable_contact_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select c.id from public.crm_contacts c
  where c.org_id = public.get_current_user_org_id()
    and (public.is_org_admin() or (public.is_org_crm() and c.owner_id = auth.uid()));
$$;

create or replace function public.my_hosted_event_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select e.id from public.events e where e.host_id = auth.uid() or e.created_by = auth.uid();
$$;

revoke execute on function public.my_teaching_batch_ids(), public.my_enrolled_batch_ids(), public.my_enrolled_course_ids(),
  public.my_student_ids(), public.my_teacher_ids(), public.my_taught_course_ids(), public.my_manageable_contact_ids(),
  public.my_hosted_event_ids() from public, anon;
grant execute on function public.my_teaching_batch_ids(), public.my_enrolled_batch_ids(), public.my_enrolled_course_ids(),
  public.my_student_ids(), public.my_teacher_ids(), public.my_taught_course_ids(), public.my_manageable_contact_ids(),
  public.my_hosted_event_ids() to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Access rules, rewritten (generated from the rules as they stood after
--    Phase 14; only the way each check is evaluated changes)
-- ----------------------------------------------------------------------------
drop policy if exists "invites_manage" on public.batch_invites;
create policy "invites_manage" on public.batch_invites
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND ((SELECT public.is_org_admin()) OR (batch_id IN (SELECT public.my_teaching_batch_ids())))))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND ((SELECT public.is_org_admin()) OR (batch_id IN (SELECT public.my_teaching_batch_ids())))));

drop policy if exists "invites_select_own" on public.batch_invites;
create policy "invites_select_own" on public.batch_invites
  as permissive for select to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (lower(email) = lower(COALESCE(((SELECT auth.jwt()) ->> 'email'::text), ''::text)))));

drop policy if exists "batches_manage" on public.batches;
create policy "batches_manage" on public.batches
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND ((SELECT public.is_org_admin()) OR ((teacher_id = (SELECT auth.uid())) AND ((SELECT public.get_current_user_role()) = 'teacher'::text)))))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND ((SELECT public.is_org_admin()) OR ((teacher_id = (SELECT auth.uid())) AND ((SELECT public.get_current_user_role()) = 'teacher'::text)))));

drop policy if exists "batches_select" on public.batches;
create policy "batches_select" on public.batches
  as permissive for select to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND ((SELECT public.is_org_admin()) OR (teacher_id = (SELECT auth.uid())) OR (id IN (SELECT public.my_enrolled_batch_ids())))));

drop policy if exists "checkins_admin" on public.checkins;
create policy "checkins_admin" on public.checkins
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_admin())))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_admin())));

drop policy if exists "checkins_select" on public.checkins;
create policy "checkins_select" on public.checkins
  as permissive for select to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND ((student_id = (SELECT auth.uid())) OR (SELECT public.is_org_admin()) OR (batch_id IN (SELECT public.my_teaching_batch_ids())))));

drop policy if exists "checkins_student_insert" on public.checkins;
create policy "checkins_student_insert" on public.checkins
  as permissive for insert to authenticated
  with check (((student_id = (SELECT auth.uid())) AND (org_id = (SELECT public.get_current_user_org_id())) AND (batch_id IN (SELECT public.my_enrolled_batch_ids())) AND (day_number = batch_current_day(batch_id))));

drop policy if exists "checkins_student_insert_past" on public.checkins;
create policy "checkins_student_insert_past" on public.checkins
  as permissive for insert to authenticated
  with check (((student_id = (SELECT auth.uid())) AND (org_id = (SELECT public.get_current_user_org_id())) AND (batch_id IN (SELECT public.my_enrolled_batch_ids())) AND ((day_number >= 1) AND (day_number <= batch_current_day(batch_id)))));

drop policy if exists "checkins_student_update" on public.checkins;
create policy "checkins_student_update" on public.checkins
  as permissive for update to authenticated
  using (((student_id = (SELECT auth.uid())) AND (org_id = (SELECT public.get_current_user_org_id())) AND (day_number = batch_current_day(batch_id))))
  with check (((student_id = (SELECT auth.uid())) AND (org_id = (SELECT public.get_current_user_org_id())) AND (batch_id IN (SELECT public.my_enrolled_batch_ids())) AND (day_number = batch_current_day(batch_id))));

drop policy if exists "checkins_student_update_past" on public.checkins;
create policy "checkins_student_update_past" on public.checkins
  as permissive for update to authenticated
  using (((student_id = (SELECT auth.uid())) AND (org_id = (SELECT public.get_current_user_org_id())) AND ((day_number >= 1) AND (day_number <= batch_current_day(batch_id)))))
  with check (((student_id = (SELECT auth.uid())) AND (org_id = (SELECT public.get_current_user_org_id())) AND (batch_id IN (SELECT public.my_enrolled_batch_ids())) AND ((day_number >= 1) AND (day_number <= batch_current_day(batch_id)))));

drop policy if exists "consent_events_read" on public.consent_events;
create policy "consent_events_read" on public.consent_events
  as permissive for select to authenticated
  using (((profile_id = (SELECT auth.uid())) OR ((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_admin()))));

drop policy if exists "courses_admin" on public.courses;
create policy "courses_admin" on public.courses
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_admin())))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_admin())));

drop policy if exists "courses_select" on public.courses;
create policy "courses_select" on public.courses
  as permissive for select to authenticated
  using ((org_id = (SELECT public.get_current_user_org_id())));

drop policy if exists "courses_teacher_insert" on public.courses;
create policy "courses_teacher_insert" on public.courses
  as permissive for insert to authenticated
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff()) AND (created_by = (SELECT auth.uid()))));

drop policy if exists "courses_teacher_update" on public.courses;
create policy "courses_teacher_update" on public.courses
  as permissive for update to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff()) AND (created_by = (SELECT auth.uid()))))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff()) AND (created_by = (SELECT auth.uid()))));

drop policy if exists "crm_activities_delete_own" on public.crm_activities;
create policy "crm_activities_delete_own" on public.crm_activities
  as permissive for delete to authenticated
  using (((created_by = (SELECT auth.uid())) AND (contact_id IN (SELECT public.my_manageable_contact_ids()))));

drop policy if exists "crm_activities_insert" on public.crm_activities;
create policy "crm_activities_insert" on public.crm_activities
  as permissive for insert to authenticated
  with check (((contact_id IN (SELECT public.my_manageable_contact_ids())) AND (created_by = (SELECT auth.uid())) AND (org_id = (SELECT public.get_current_user_org_id())) AND (kind <> 'stage'::text)));

drop policy if exists "crm_activities_select" on public.crm_activities;
create policy "crm_activities_select" on public.crm_activities
  as permissive for select to authenticated
  using ((contact_id IN (SELECT public.my_manageable_contact_ids())));

drop policy if exists "crm_contacts_admin" on public.crm_contacts;
create policy "crm_contacts_admin" on public.crm_contacts
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_admin())))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_admin())));

drop policy if exists "crm_contacts_volunteer_own" on public.crm_contacts;
create policy "crm_contacts_volunteer_own" on public.crm_contacts
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_crm()) AND (owner_id = (SELECT auth.uid()))))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_crm()) AND (owner_id = (SELECT auth.uid()))));

drop policy if exists "enrolments_leave" on public.enrolments;
create policy "enrolments_leave" on public.enrolments
  as permissive for delete to authenticated
  using ((student_id = (SELECT auth.uid())));

drop policy if exists "enrolments_manage" on public.enrolments;
create policy "enrolments_manage" on public.enrolments
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND ((SELECT public.is_org_admin()) OR (batch_id IN (SELECT public.my_teaching_batch_ids())))))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND ((SELECT public.is_org_admin()) OR (batch_id IN (SELECT public.my_teaching_batch_ids())))));

drop policy if exists "enrolments_select" on public.enrolments;
create policy "enrolments_select" on public.enrolments
  as permissive for select to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND ((student_id = (SELECT auth.uid())) OR (SELECT public.is_org_admin()) OR (batch_id IN (SELECT public.my_teaching_batch_ids())))));

drop policy if exists "registrations_select_own" on public.event_registrations;
create policy "registrations_select_own" on public.event_registrations
  as permissive for select to authenticated
  using ((profile_id = (SELECT auth.uid())));

drop policy if exists "registrations_staff_host_manage" on public.event_registrations;
create policy "registrations_staff_host_manage" on public.event_registrations
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff()) AND ((SELECT public.is_org_admin()) OR (event_id IN (SELECT public.my_hosted_event_ids())))))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff()) AND ((SELECT public.is_org_admin()) OR (event_id IN (SELECT public.my_hosted_event_ids())))));

drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events
  as permissive for select to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (published OR (SELECT public.is_org_staff()))));

drop policy if exists "events_staff_manage" on public.events;
create policy "events_staff_manage" on public.events
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff())))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff())));

drop policy if exists "followup_records_staff_manage" on public.followup_records;
create policy "followup_records_staff_manage" on public.followup_records
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND ((SELECT public.is_org_admin()) OR (batch_id IN (SELECT public.my_teaching_batch_ids())))))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND ((SELECT public.is_org_admin()) OR (batch_id IN (SELECT public.my_teaching_batch_ids())))));

drop policy if exists "followup_steps_select" on public.followup_steps;
create policy "followup_steps_select" on public.followup_steps
  as permissive for select to authenticated
  using ((org_id = (SELECT public.get_current_user_org_id())));

drop policy if exists "followup_steps_staff_manage" on public.followup_steps;
create policy "followup_steps_staff_manage" on public.followup_steps
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff())))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff())));

drop policy if exists "modules_staff_manage" on public.lesson_modules;
create policy "modules_staff_manage" on public.lesson_modules
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff())))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff())));

drop policy if exists "modules_student_select" on public.lesson_modules;
create policy "modules_student_select" on public.lesson_modules
  as permissive for select to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND published AND (course_id IN (SELECT public.my_enrolled_course_ids()))));

drop policy if exists "progress_delete_own" on public.lesson_progress;
create policy "progress_delete_own" on public.lesson_progress
  as permissive for delete to authenticated
  using ((student_id = (SELECT auth.uid())));

drop policy if exists "progress_insert_own" on public.lesson_progress;
create policy "progress_insert_own" on public.lesson_progress
  as permissive for insert to authenticated
  with check (((student_id = (SELECT auth.uid())) AND (org_id = (SELECT public.get_current_user_org_id())) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_progress.lesson_id) AND (l.module_id IS NOT NULL) AND l.published AND module_unlocked_for_me(l.module_id))))));

drop policy if exists "progress_select" on public.lesson_progress;
create policy "progress_select" on public.lesson_progress
  as permissive for select to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND ((student_id = (SELECT auth.uid())) OR (SELECT public.is_org_admin()) OR (student_id IN (SELECT public.my_student_ids())))));

drop policy if exists "lessons_admin" on public.lessons;
create policy "lessons_admin" on public.lessons
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_admin())))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_admin())));

drop policy if exists "lessons_module_unlocked" on public.lessons;
create policy "lessons_module_unlocked" on public.lessons
  as restrictive for select to authenticated
  using (((module_id IS NULL) OR (SELECT public.is_org_staff()) OR module_unlocked_for_me(module_id)));

drop policy if exists "lessons_select" on public.lessons;
create policy "lessons_select" on public.lessons
  as permissive for select to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND ((SELECT public.is_org_admin()) OR (author_id = (SELECT auth.uid())) OR ((scope = 'batch'::text) AND (batch_id IN (SELECT public.my_teaching_batch_ids()))) OR (published AND ((scope = 'general'::text) OR ((scope = 'course'::text) AND ((course_id IN (SELECT public.my_enrolled_course_ids())) OR (course_id IN (SELECT public.my_taught_course_ids())))) OR ((scope = 'batch'::text) AND (batch_id IN (SELECT public.my_enrolled_batch_ids()))))))));

drop policy if exists "lessons_staff_module_manage" on public.lessons;
create policy "lessons_staff_module_manage" on public.lessons
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff()) AND (module_id IS NOT NULL)))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff()) AND (scope = 'course'::text) AND (module_id IS NOT NULL)));

drop policy if exists "lessons_teacher_manage" on public.lessons;
create policy "lessons_teacher_manage" on public.lessons
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (scope = 'batch'::text) AND (batch_id IN (SELECT public.my_teaching_batch_ids()))))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (scope = 'batch'::text) AND (batch_id IN (SELECT public.my_teaching_batch_ids()))));

drop policy if exists "org_admin_update" on public.organisations;
create policy "org_admin_update" on public.organisations
  as permissive for update to authenticated
  using (((id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_admin())))
  with check (((id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_admin())));

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  as permissive for update to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_admin())))
  with check ((org_id = (SELECT public.get_current_user_org_id())));

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  as permissive for select to authenticated
  using (((id = (SELECT auth.uid())) OR ((org_id = (SELECT public.get_current_user_org_id())) AND ((SELECT public.is_org_admin()) OR (id IN (SELECT public.my_student_ids())) OR (id IN (SELECT public.my_teacher_ids()))))));

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  as permissive for update to authenticated
  using ((id = (SELECT auth.uid())))
  with check ((id = (SELECT auth.uid())));

drop policy if exists "materials_staff_manage" on public.programme_materials;
create policy "materials_staff_manage" on public.programme_materials
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff())))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_staff())));

drop policy if exists "materials_student_read" on public.programme_materials;
create policy "materials_student_read" on public.programme_materials
  as permissive for select to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND published AND (course_id IN (SELECT public.my_enrolled_course_ids()))));

drop policy if exists "role_grants_admin" on public.role_grants;
create policy "role_grants_admin" on public.role_grants
  as permissive for all to authenticated
  using (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_admin())))
  with check (((org_id = (SELECT public.get_current_user_org_id())) AND (SELECT public.is_org_admin())));

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  as permissive for delete to authenticated
  using (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = ((SELECT auth.uid()))::text)));

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  as permissive for insert to authenticated
  with check (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = ((SELECT auth.uid()))::text)));

drop policy if exists "avatars_select_own" on storage.objects;
create policy "avatars_select_own" on storage.objects
  as permissive for select to authenticated
  using (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = ((SELECT auth.uid()))::text)));

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  as permissive for update to authenticated
  using (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = ((SELECT auth.uid()))::text)))
  with check (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = ((SELECT auth.uid()))::text)));


-- ----------------------------------------------------------------------------
-- 3. Indexes
-- ----------------------------------------------------------------------------
create index if not exists checkins_batch_day_idx on public.checkins (batch_id, day_number);
create index if not exists enrolments_student_idx on public.enrolments (student_id);
create index if not exists batches_teacher_idx on public.batches (teacher_id);
create index if not exists batches_course_idx on public.batches (course_id);
create index if not exists profiles_org_idx on public.profiles (org_id);
create index if not exists lesson_progress_lesson_idx on public.lesson_progress (lesson_id);
create index if not exists lessons_course_idx on public.lessons (course_id);
create index if not exists lessons_batch_idx on public.lessons (batch_id);
create index if not exists event_registrations_profile_idx on public.event_registrations (profile_id);
create index if not exists events_host_idx on public.events (host_id);
create index if not exists events_created_by_idx on public.events (created_by);
create index if not exists followup_records_student_idx on public.followup_records (student_id);
create index if not exists crm_contacts_profile_idx on public.crm_contacts (profile_id);
create index if not exists courses_created_by_idx on public.courses (created_by);

-- ----------------------------------------------------------------------------
-- 4. Errors people run into (reported by the app; admins read them)
-- ----------------------------------------------------------------------------
create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organisations(id) on delete cascade,
  user_id uuid,
  message text not null,
  detail text,
  page text,
  app_version text,
  created_at timestamptz not null default now()
);
create index if not exists client_errors_org_time_idx on public.client_errors (org_id, created_at desc);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon;
revoke insert, update, delete, truncate on public.client_errors from authenticated;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'client_errors' and policyname = 'client_errors_admin_read') then
    create policy "client_errors_admin_read" on public.client_errors
      for select to authenticated
      using (org_id = (select public.get_current_user_org_id()) and (select public.is_org_admin()));
  end if;
end $$;

-- At most 20 reports per person per hour; texts are cut short; older than 90 days are removed
create or replace function public.log_client_error(p_message text, p_detail text default null, p_page text default null, p_app_version text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from public.client_errors
      where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then
    return;
  end if;
  insert into public.client_errors (org_id, user_id, message, detail, page, app_version)
  values (public.get_current_user_org_id(), auth.uid(), left(coalesce(p_message, ''), 500),
          left(p_detail, 4000), left(p_page, 200), left(p_app_version, 40));
  delete from public.client_errors where created_at < now() - interval '90 days';
end;
$$;
revoke execute on function public.log_client_error(text, text, text, text) from public, anon;
grant execute on function public.log_client_error(text, text, text, text) to authenticated;
