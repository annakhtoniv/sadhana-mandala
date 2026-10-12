-- ============================================================================
-- Sadhana Mandala: Phase 4 verification
--
-- Run in the Supabase SQL editor after phase4_security.sql and
-- seed_dummy_data.sql. It signs in as the fictional seed users one at a time
-- (by setting the same JWT claims Supabase sets for a real sign-in) and checks
-- what each of them can see and change. Nothing is saved: every write attempt
-- is rolled back immediately.
--
-- Result: a table of checks. Every row must say PASS.
-- ============================================================================

create temp table if not exists phase4_results (n serial, persona text, check_name text, expected text, actual text, result text);
truncate phase4_results;

do $$
declare
  v_org_a uuid := (select id from public.organisations where slug = 'sadhana-mandala');
  v_org_b uuid := (select id from public.organisations where slug = 'prana-flow');
  v_autumn uuid := 'd1000000-0000-0000-0000-000000000001';
  v_moon   uuid := 'd1000000-0000-0000-0000-000000000003';
  v_prana  uuid := 'd2000000-0000-0000-0000-000000000001';
  v_ananda uuid := 'b0000000-0000-0000-0000-000000000001';
  v_admin_a uuid := 'b0000000-0000-0000-0000-000000000003';
  v_marcus uuid := 'c0000000-0000-0000-0000-000000000001';
  v_student01 uuid := 'd0000000-0000-0000-0000-000000000001';
  v_day int;
  v_n int;
  v_txt text;
  r text[] := '{}';   -- persona|check|expected|actual

  -- counts rows of every org-scoped table that belong to the given org
  v_sql_foreign text := $q$
    select (select count(*) from public.batches where org_id = $1)
         + (select count(*) from public.enrolments where org_id = $1)
         + (select count(*) from public.checkins where org_id = $1)
         + (select count(*) from public.profiles where org_id = $1)
         + (select count(*) from public.courses where org_id = $1)
         + (select count(*) from public.lessons where org_id = $1)
         + (select count(*) from public.batch_invites where org_id = $1)
         + (select count(*) from public.role_grants where org_id = $1)
  $q$;
begin
  select ((now() at time zone o.timezone)::date - b.start_date) + 1 into v_day
  from public.batches b join public.organisations o on o.id = b.org_id where b.id = v_autumn;

  -- ------------------------------------------------------------------ Teacher A
  perform set_config('request.jwt.claims', json_build_object('sub', v_ananda, 'email', 'teacher.ananda@example.com', 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into v_n from public.batches;
  r := r || array['Teacher A (Ananda)|sees only own batches|2', v_n::text];

  select count(*) into v_n from public.enrolments where batch_id = v_autumn;
  r := r || array['Teacher A (Ananda)|Autumn roster size|30', v_n::text];

  select count(*) into v_n from public.enrolments e join public.profiles p on p.id = e.student_id where e.batch_id = v_autumn;
  r := r || array['Teacher A (Ananda)|Autumn roster names visible|30', v_n::text];

  select string_agg(s || '=' || coalesce(c, 0), ' ' order by s) into v_txt
  from unnest(array['done', 'rest', 'not_yet']) s
  left join (select status, count(*) c from public.checkins where batch_id = v_autumn and day_number = v_day group by status) x on x.status = s;
  r := r || array['Teacher A (Ananda)|Autumn today (day ' || v_day || ') counts|done=6 not_yet=2 rest=2', v_txt];

  select count(*) into v_n from public.enrolments e where e.batch_id = v_autumn
    and not exists (select 1 from public.checkins c where c.batch_id = v_autumn and c.student_id = e.student_id and c.day_number = v_day);
  r := r || array['Teacher A (Ananda)|Autumn no answer today|20', v_n::text];

  select count(*) into v_n from public.enrolments e where e.batch_id = v_autumn
    and not exists (select 1 from public.checkins c where c.batch_id = v_autumn and c.student_id = e.student_id and c.day_number between v_day - 3 and v_day);
  r := r || array['Teacher A (Ananda)|Autumn quiet students (4 silent days)|5', v_n::text];

  execute v_sql_foreign into v_n using v_org_b;
  r := r || array['Teacher A (Ananda)|rows visible from Org B (all tables)|0', v_n::text];

  select count(*) into v_n from public.enrolments where batch_id = v_moon;
  r := r || array['Teacher A (Ananda)|another teacher''s roster (New Moon)|0', v_n::text];

  select count(*) into v_n from public.role_grants;
  r := r || array['Teacher A (Ananda)|role grants visible|0', v_n::text];

  begin
    update public.profiles set role = 'admin' where id = v_ananda;
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Teacher A (Ananda)|make myself admin|blocked', v_txt];

  begin
    update public.profiles set org_id = v_org_b where id = v_ananda;
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Teacher A (Ananda)|move myself to Org B|blocked', v_txt];

  begin
    execute 'select public.set_my_role(''admin'')';
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Teacher A (Ananda)|set_my_role RPC|blocked', v_txt];

  begin
    v_txt := coalesce(public.join_batch_by_code('PRANA10')->>'success', 'null');
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error'; end if; end;
  r := r || array['Teacher A (Ananda)|join Org B batch by code|false', v_txt];

  begin
    insert into public.checkins (org_id, student_id, batch_id, day_number, status)
    values (v_org_a, v_student01, v_autumn, v_day, 'done')
    on conflict (student_id, batch_id, day_number) do update set status = 'done';
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Teacher A (Ananda)|write a student''s check-in|blocked', v_txt];

  reset role;

  -- ------------------------------------------------------------------ Teacher B
  perform set_config('request.jwt.claims', json_build_object('sub', v_marcus, 'email', 'teacher.marcus@example.com', 'role', 'authenticated')::text, true);
  set local role authenticated;

  execute v_sql_foreign into v_n using v_org_a;
  r := r || array['Teacher B (Marcus)|rows visible from Org A (all tables)|0', v_n::text];

  select count(*) into v_n from public.enrolments where batch_id = v_prana;
  r := r || array['Teacher B (Marcus)|Prana roster size|5', v_n::text];

  begin
    v_txt := coalesce(public.join_batch_by_code('AUTUMN23')->>'success', 'null');
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error'; end if; end;
  r := r || array['Teacher B (Marcus)|join Org A batch by code|false', v_txt];

  reset role;

  -- ------------------------------------------------------------------ Student A
  perform set_config('request.jwt.claims', json_build_object('sub', v_student01, 'email', 'student01@example.com', 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into v_n from public.checkins where student_id <> v_student01;
  r := r || array['Student (Aarav)|other students'' check-ins visible|0', v_n::text];

  select count(*) into v_n from public.profiles;
  r := r || array['Student (Aarav)|profiles visible (self + own teachers)|2', v_n::text];

  begin
    insert into public.checkins (org_id, student_id, batch_id, day_number, status)
    values (v_org_a, v_student01, v_autumn, v_day, 'rest')
    on conflict (student_id, batch_id, day_number) do update set status = 'rest';
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked: ' || sqlerrm end; end;
  r := r || array['Student (Aarav)|check in for today (twice = update)|allowed', v_txt];

  begin
    update public.checkins set status = 'not_yet' where student_id = v_student01 and batch_id = v_autumn and day_number = v_day - 1;
    get diagnostics v_n = row_count;
    if v_n > 0 then raise exception 'PROBE_WROTE'; end if;
    v_txt := 'blocked';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|change yesterday''s answer|blocked', v_txt];

  reset role;

  -- ------------------------------------------------------------------ Admin A
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_a, 'email', 'admin.sadhana@example.com', 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into v_n from public.batches;
  r := r || array['Admin A|sees all Org A batches|3', v_n::text];

  execute v_sql_foreign into v_n using v_org_b;
  r := r || array['Admin A|rows visible from Org B (all tables)|0', v_n::text];

  reset role;

  -- ------------------------------------------------------------------ Anonymous
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  begin
    select count(*) into v_n from public.checkins;
    v_txt := v_n::text;
  exception when others then v_txt := '0'; end;
  r := r || array['Anonymous visitor|check-ins visible|0', v_txt];
  reset role;

  -- ------------------------------------------------------------------ Results
  for i in 1 .. array_length(r, 1) / 2 loop
    insert into phase4_results (persona, check_name, expected, actual, result)
    select split_part(r[2*i-1], '|', 1), split_part(r[2*i-1], '|', 2), split_part(r[2*i-1], '|', 3), r[2*i],
           case when split_part(r[2*i-1], '|', 3) = r[2*i] then 'PASS' else 'FAIL' end;
  end loop;
end;
$$;

select persona, check_name, expected, actual, result from phase4_results order by n;
