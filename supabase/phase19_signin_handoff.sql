-- ============================================================================
-- Sadhana Mandala: Phase 19 migration (stay signed in on the Home Screen app)
--
-- PM report 2026-10-19: signed in on the iPhone Home Screen app at night, found
-- it signed out in the morning (so no morning reminder either). On iPhone,
-- Google sign-in from a Home Screen app opens in a small Safari window, and
-- the sign-in stayed in that window: the app itself never got it.
--
-- The fix hands the sign-in over through the database for a few minutes:
--  1. The app starts the sign-in with a random hand-over id in the return
--     address and keeps a secret key (the PKCE verifier) on the phone.
--  2. The Safari window comes back with a one-time code. It cannot use the
--     code without the app's secret key, so it leaves the code here, under the
--     hand-over id, and tells the person to go back to the app.
--  3. The app picks the code up once (it is deleted at once) and signs in.
-- The code alone is useless to anyone else: only the phone that started the
-- sign-in holds the matching secret key. Codes older than 10 minutes are gone.
--
-- Safe to run more than once. Run after phase18_reminders.sql, then verify.sql.
-- ============================================================================

create table if not exists public.auth_handoffs (
  id uuid primary key,
  code text not null check (char_length(code) between 1 and 200),
  flow_id text check (flow_id is null or char_length(flow_id) <= 100),
  created_at timestamptz not null default now()
);

-- Nobody reads or writes the table directly: only the two functions below
alter table public.auth_handoffs enable row level security;
revoke all on public.auth_handoffs from public, anon, authenticated;

-- The Safari window leaves the one-time code. An id that is already taken is
-- never overwritten.
create or replace function public.put_auth_handoff(p_id uuid, p_code text, p_flow_id text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.auth_handoffs where created_at < now() - interval '10 minutes';
  if p_id is null or p_code is null or char_length(p_code) not between 1 and 200
     or char_length(coalesce(p_flow_id, '')) > 100 then
    raise exception 'Invalid sign-in hand-over';
  end if;
  insert into public.auth_handoffs (id, code, flow_id) values (p_id, p_code, nullif(p_flow_id, ''))
  on conflict (id) do nothing;
end;
$$;

-- The app picks the code up, once
create or replace function public.take_auth_handoff(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  h record;
begin
  delete from public.auth_handoffs where created_at < now() - interval '10 minutes';
  delete from public.auth_handoffs where id = p_id
  returning code, flow_id into h;
  if h.code is null then
    return null;
  end if;
  return json_build_object('code', h.code, 'flow_id', h.flow_id);
end;
$$;

-- Before sign-in the app is an anonymous visitor
revoke execute on function public.put_auth_handoff(uuid, text, text), public.take_auth_handoff(uuid) from public;
grant execute on function public.put_auth_handoff(uuid, text, text), public.take_auth_handoff(uuid) to anon, authenticated;
