-- ============================================================================
-- Sadhana Mandala: Phase 20 migration (every batch has a start and an end date)
--
-- PM request 2026-10-19: all batches must show a start date and an end date.
-- Batches only had a start date. This adds end_date:
--  - Existing batches get it from their programme: the last day of the daily
--    practice (e.g. day 40), else the last day of the programme itself
--    (programme_days), else the start date. A batch that already has an end
--    date keeps it.
--  - A new batch saved without an end date gets the same default.
--  - The end date can never be before the start date.
-- Teachers and admins can change it in the batch editor.
--
-- Safe to run more than once. Run after phase19_signin_handoff.sql, then
-- verify.sql.
-- ============================================================================

alter table public.batches add column if not exists end_date date;

-- The usual last day of a batch of this programme starting on p_start
create or replace function public.batch_default_end_date(p_course_id uuid, p_start date)
returns date language sql stable security definer set search_path = public as $$
  select p_start + greatest(coalesce(
    case when c.has_practice_track then c.duration_days end,
    c.programme_days,
    1
  ), 1) - 1
  from public.courses c where c.id = p_course_id;
$$;
revoke execute on function public.batch_default_end_date(uuid, date) from public, anon;
grant execute on function public.batch_default_end_date(uuid, date) to authenticated;

-- A batch saved without an end date gets the default
create or replace function public.fill_batch_end_date()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.end_date is null then
    new.end_date := coalesce(public.batch_default_end_date(new.course_id, new.start_date), new.start_date);
  end if;
  return new;
end;
$$;
drop trigger if exists batches_fill_end_date on public.batches;
create trigger batches_fill_end_date
  before insert or update on public.batches
  for each row execute function public.fill_batch_end_date();

-- Existing batches without one (batches that already have an end date keep it)
update public.batches
set end_date = coalesce(public.batch_default_end_date(course_id, start_date), start_date)
where end_date is null;

alter table public.batches alter column end_date set not null;
alter table public.batches drop constraint if exists batches_end_after_start;
alter table public.batches add constraint batches_end_after_start check (end_date >= start_date);
