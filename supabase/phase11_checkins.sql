-- ============================================================================
-- Sadhana Mandala: Phase 11 migration (Morning and Evening check-ins)
--
-- PM decision 2026-10-18:
-- - No more rest days. Each day of the practice has two ticks: Morning and
--   Evening. A student ticks one or both.
-- - A day counts (streak, 40-day trail, reports) when at least one is ticked.
-- - Students may check in for any past day of their batch, not only today.
--   A check-in written after its day is marked "late" so teachers can see it.
--
-- checkins gains: morning, evening (booleans), morning_at, evening_at and
-- late. The old status column stays for older app versions and is kept in
-- step automatically: 'done' when morning or evening is ticked, otherwise
-- 'not_yet'. Old 'done' rows become Morning ticks.
--
-- Adds columns, a trigger, a function and two policies; nothing is dropped.
-- Safe to run more than once. Run after supabase/phase9_crm.sql, then
-- seed_dummy_data.sql, then verify.sql.
-- ============================================================================

alter table public.checkins add column if not exists morning boolean not null default false;
alter table public.checkins add column if not exists evening boolean not null default false;
alter table public.checkins add column if not exists morning_at timestamptz;
alter table public.checkins add column if not exists evening_at timestamptz;
alter table public.checkins add column if not exists late boolean not null default false;

-- Existing answers: "done" becomes a Morning tick (rest days carry no tick)
update public.checkins
set morning = true, morning_at = coalesce(morning_at, updated_at, created_at)
where status = 'done' and not morning and not evening;

-- Keep the columns in step, stamp the times and mark late entries
create or replace function public.checkin_before_save()
returns trigger language plpgsql security definer set search_path = public as $$
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
revoke execute on function public.checkin_before_save() from public, anon, authenticated;

create or replace trigger tr_checkin_before_save
  before insert or update on public.checkins
  for each row execute function public.checkin_before_save();

-- ----------------------------------------------------------------------------
-- Policies: students may also write any past day of their batch (never a
-- future day). These are added next to the Phase 4 "today only" policies;
-- permissive policies combine, so the wider rule applies. The Phase 5
-- restrictive rule (practice-track programmes, days 1..track length) still
-- applies on top.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'checkins' and policyname = 'checkins_student_insert_past') then
    create policy "checkins_student_insert_past" on public.checkins
      for insert to authenticated with check (
        student_id = auth.uid()
        and org_id = public.get_current_user_org_id()
        and public.is_enrolled_in_batch(batch_id)
        and day_number between 1 and public.batch_current_day(batch_id)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'checkins' and policyname = 'checkins_student_update_past') then
    create policy "checkins_student_update_past" on public.checkins
      for update to authenticated
      using (student_id = auth.uid() and org_id = public.get_current_user_org_id()
             and day_number between 1 and public.batch_current_day(batch_id))
      with check (student_id = auth.uid() and org_id = public.get_current_user_org_id()
                  and public.is_enrolled_in_batch(batch_id)
                  and day_number between 1 and public.batch_current_day(batch_id));
  end if;
end $$;

-- The funnel report (Phase 10) counts status = 'done', which now means
-- "morning or evening ticked", so it needs no change.
