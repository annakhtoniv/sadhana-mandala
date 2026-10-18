-- ============================================================================
-- Sadhana Mandala: Phase 12 migration (profile pictures, study materials)
--
-- PM requests 2026-10-18:
-- 1. Profile pictures. Everyone gets their Google photo automatically (also
--    existing users), and can upload their own instead.
--    - profiles.avatar_url: the picture shown in the app; avatar_source:
--      'google' or 'upload'. Only a Google photo or a file in this project's
--      public "avatars" bucket is accepted (no other web addresses).
--    - sync_my_google_avatar(): called at every sign-in; refreshes the Google
--      photo unless the person uploaded their own.
--    - Storage bucket "avatars" (public, images up to 2 MB): each person may
--      only write in their own folder (avatars/<user id>/...).
-- 2. Study materials per programme (PDF, audio, video, images, other files,
--    or a link), shared by every batch of the programme.
--    - programme_materials: the list; staff manage it; students see the
--      published materials of programmes they are enrolled in.
--    - Storage bucket "materials" (private, files up to 50 MB): files live in
--      materials/<org id>/<programme id>/...; staff of the organisation may
--      upload; students enrolled in the programme may read.
--
-- Adds columns, tables, buckets, functions and policies; nothing is dropped.
-- Safe to run more than once. Run after supabase/phase11_checkins.sql, then
-- seed_dummy_data.sql, then verify.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Profile pictures
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_source text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_url_check') then
    alter table public.profiles add constraint profiles_avatar_url_check check (
      avatar_url is null
      or avatar_url ~ '^https://lh[0-9]+\.googleusercontent\.com/'
      or avatar_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/'
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_source_check') then
    alter table public.profiles add constraint profiles_avatar_source_check
      check (avatar_source is null or avatar_source in ('google', 'upload'));
  end if;
end $$;

-- The Google photo of the signed-in user (from the Google sign-in details)
create or replace function public.sync_my_google_avatar()
returns text language plpgsql security definer set search_path = public as $$
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
revoke execute on function public.sync_my_google_avatar() from public, anon;
grant execute on function public.sync_my_google_avatar() to authenticated;

-- Existing users get their Google photo now
update public.profiles p
set avatar_url = coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture'),
    avatar_source = 'google'
from auth.users u
where u.id = p.id
  and p.avatar_source is null
  and coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') ~ '^https://lh[0-9]+\.googleusercontent\.com/';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Study materials per programme
-- ----------------------------------------------------------------------------
create table if not exists public.programme_materials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  kind text not null check (kind in ('pdf', 'audio', 'video', 'image', 'file', 'link')),
  storage_path text,
  url text check (url is null or url ~* '^https://'),
  mime_type text,
  size_bytes bigint,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programme_materials_source check (
    (kind = 'link' and url is not null) or (kind <> 'link' and storage_path is not null)
  )
);
create index if not exists programme_materials_course_idx on public.programme_materials (course_id, sort_order);
alter table public.programme_materials enable row level security;

-- Caller is enrolled in any batch of this programme
create or replace function public.is_enrolled_in_course(p_course_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.enrolments e
    join public.batches b on b.id = e.batch_id
    where e.student_id = auth.uid() and b.course_id = p_course_id
  );
$$;

-- Storage paths are <org id>/<programme id>/<file>
create or replace function public.can_manage_material_path(p_name text)
returns boolean language sql security definer stable set search_path = public as $$
  select split_part(p_name, '/', 1) = public.get_current_user_org_id()::text
     and public.is_org_staff()
     and exists (select 1 from public.courses c
                 where c.id::text = split_part(p_name, '/', 2) and c.org_id = public.get_current_user_org_id());
$$;

create or replace function public.can_read_material_path(p_name text)
returns boolean language sql security definer stable set search_path = public as $$
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

revoke execute on function public.is_enrolled_in_course(uuid), public.can_manage_material_path(text),
  public.can_read_material_path(text) from public, anon;
grant execute on function public.is_enrolled_in_course(uuid), public.can_manage_material_path(text),
  public.can_read_material_path(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 52428800,
        array['application/pdf', 'audio/*', 'video/*', 'image/*', 'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-powerpoint',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'text/plain'])
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Policies (created only if missing; nothing dropped)
-- ----------------------------------------------------------------------------
do $$
begin
  -- programme_materials
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'programme_materials' and policyname = 'materials_staff_manage') then
    create policy "materials_staff_manage" on public.programme_materials
      for all to authenticated
      using (org_id = public.get_current_user_org_id() and public.is_org_staff())
      with check (org_id = public.get_current_user_org_id() and public.is_org_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'programme_materials' and policyname = 'materials_student_read') then
    create policy "materials_student_read" on public.programme_materials
      for select to authenticated
      using (org_id = public.get_current_user_org_id() and published and public.is_enrolled_in_course(course_id));
  end if;

  -- storage: avatars (public read through the public bucket; write own folder only)
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_insert_own') then
    create policy "avatars_insert_own" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_update_own') then
    create policy "avatars_update_own" on storage.objects
      for update to authenticated
      using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text)
      with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_delete_own') then
    create policy "avatars_delete_own" on storage.objects
      for delete to authenticated
      using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
  end if;

  -- storage: materials (private)
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'materials_read') then
    create policy "materials_read" on storage.objects
      for select to authenticated
      using (bucket_id = 'materials' and public.can_read_material_path(name));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'materials_insert_staff') then
    create policy "materials_insert_staff" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'materials' and public.can_manage_material_path(name));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'materials_update_staff') then
    create policy "materials_update_staff" on storage.objects
      for update to authenticated
      using (bucket_id = 'materials' and public.can_manage_material_path(name))
      with check (bucket_id = 'materials' and public.can_manage_material_path(name));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'materials_delete_staff') then
    create policy "materials_delete_staff" on storage.objects
      for delete to authenticated
      using (bucket_id = 'materials' and public.can_manage_material_path(name));
  end if;
end $$;
