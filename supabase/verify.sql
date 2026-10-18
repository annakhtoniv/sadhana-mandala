-- ============================================================================
-- Sadhana Mandala: verification (phases 4 to 14)
--
-- Run in the Supabase SQL editor after phase4_security.sql,
-- phase5_programmes.sql, phase6_lms.sql, phase7_followups.sql,
-- phase8_events.sql, phase9_crm.sql, phase11_checkins.sql, phase12_media.sql,
-- phase13_roles.sql, phase14_safety.sql and seed_dummy_data.sql. It signs in as the fictional seed users one at a time
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
  v_vtp    uuid := 'd1000000-0000-0000-0000-000000000006';
  v_hp_course uuid := 'c1000000-0000-0000-0000-000000000001';
  v_mod_week2 uuid := 'f1000000-0000-0000-0000-000000000003';
  v_lesson_week2  uuid := 'f2000000-0000-0000-0000-000000000005';
  v_lesson_deeper uuid := 'f2000000-0000-0000-0000-000000000006';
  v_fu_call1 uuid := 'e3000000-0000-0000-0000-000000000002';
  v_student21 uuid := 'd0000000-0000-0000-0000-000000000021';
  v_ev_talk_next uuid := 'e4000000-0000-0000-0000-000000000001';
  v_ev_talk_past uuid := 'e4000000-0000-0000-0000-000000000002';
  v_ev_full      uuid := 'e4000000-0000-0000-0000-000000000004';
  v_ravi  uuid := 'b0000000-0000-0000-0000-000000000004';
  v_sara  uuid := 'b0000000-0000-0000-0000-000000000005';
  v_lead_rania uuid := 'e5000000-0000-0000-0000-000000000001';
  v_lead_hiro  uuid := 'e5000000-0000-0000-0000-000000000003';
  v_lead_joel  uuid := 'e5000000-0000-0000-0000-000000000005';
  v_lead_sara  uuid := 'e5000000-0000-0000-0000-000000000007';
  v_lead_grace uuid := 'e5000000-0000-0000-0000-000000000009';
  v_json json;
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
         + (select count(*) from public.lesson_modules where org_id = $1)
         + (select count(*) from public.lesson_progress where org_id = $1)
         + (select count(*) from public.followup_steps where org_id = $1)
         + (select count(*) from public.followup_records where org_id = $1)
         + (select count(*) from public.events where org_id = $1)
         + (select count(*) from public.event_registrations where org_id = $1)
         + (select count(*) from public.crm_contacts where org_id = $1)
         + (select count(*) from public.crm_activities where org_id = $1)
  $q$;
begin
  -- Every check runs inside this inner block, which is undone at the end
  -- (raise VERIFY_UNDO). Supabase does not allow deleting storage rows with
  -- SQL, so the two test files below disappear through that undo instead.
  -- The results stay in the variable r, which the undo does not touch.
  begin
  -- Phase 12: two test files in the materials bucket (undone at the end):
  -- one for the Happiness Program, one for Sri Sri Yoga (student 1 is not enrolled)
  insert into storage.objects (id, bucket_id, name) values
    ('ab000000-0000-0000-0000-000000000001', 'materials', v_org_a::text || '/' || v_hp_course::text || '/verify-a.pdf'),
    ('ab000000-0000-0000-0000-000000000002', 'materials', v_org_a::text || '/c1000000-0000-0000-0000-000000000004/verify-b.pdf'),
    ('ab000000-0000-0000-0000-000000000003', 'materials', v_org_a::text || '/' || v_hp_course::text || '/verify-draft.pdf');
  -- Phase 14: students read only files of published materials
  insert into public.programme_materials (org_id, course_id, title, kind, storage_path, published) values
    (v_org_a, v_hp_course, 'Verify file', 'pdf', v_org_a::text || '/' || v_hp_course::text || '/verify-a.pdf', true),
    (v_org_a, v_hp_course, 'Verify draft', 'pdf', v_org_a::text || '/' || v_hp_course::text || '/verify-draft.pdf', false);

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

  select 'morning=' || count(*) filter (where morning) || ' evening=' || count(*) filter (where evening)
         || ' neither=' || count(*) filter (where not morning and not evening)
  into v_txt from public.checkins where batch_id = v_autumn and day_number = v_day;
  r := r || array['Teacher A (Ananda)|Autumn today (day ' || v_day || ') ticks|morning=8 evening=4 neither=2', v_txt];

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

  begin
    insert into public.courses (org_id, name, code, category, has_practice_track, duration_days, created_by)
    values (v_org_a, 'Verify Test Programme', 'VERIFY-TEST', 'Test', false, 40, v_ananda);
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked: ' || sqlerrm end; end;
  r := r || array['Teacher A (Ananda)|add a programme (phase 5)|allowed', v_txt];

  begin
    insert into public.courses (org_id, name, code, category, has_practice_track, duration_days)
    values (v_org_b, 'Verify Test Programme', 'VERIFY-TEST', 'Test', false, 40);
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Teacher A (Ananda)|add a programme to Org B|blocked', v_txt];

  begin
    with m as (
      insert into public.lesson_modules (org_id, course_id, title, unlock_rule)
      values (v_org_a, v_hp_course, 'Verify module', 'always') returning id
    )
    insert into public.lessons (org_id, title, body, scope, course_id, module_id, published)
    select v_org_a, 'Verify lesson', 'x', 'course', v_hp_course, m.id, true from m;
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked: ' || sqlerrm end; end;
  r := r || array['Teacher A (Ananda)|add a module and lesson (phase 6)|allowed', v_txt];

  select count(*) into v_n from public.lesson_progress;
  r := r || array['Teacher A (Ananda)|own students'' lesson progress visible|25', v_n::text];

  select count(*) into v_n from public.followup_records;
  r := r || array['Teacher A (Ananda)|Autumn follow-up records visible (phase 7)|32', v_n::text];

  begin
    insert into public.followup_records (org_id, batch_id, step_id, student_id, status, notes)
    values (v_org_a, v_autumn, v_fu_call1, v_student21, 'done', 'Verify note');
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked: ' || sqlerrm end; end;
  r := r || array['Teacher A (Ananda)|record a follow-up in own batch|allowed', v_txt];

  begin
    insert into public.followup_records (org_id, batch_id, step_id, student_id, status)
    values (v_org_a, v_moon, v_fu_call1, v_student21, 'done');
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Teacher A (Ananda)|record a follow-up in another teacher''s batch|blocked', v_txt];

  begin
    insert into public.followup_steps (org_id, course_id, kind, title, offset_day)
    values (v_org_a, v_hp_course, 'reminder', 'Verify reminder', 5);
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked: ' || sqlerrm end; end;
  r := r || array['Teacher A (Ananda)|add a follow-up plan step|allowed', v_txt];

  select count(*) into v_n from public.events;
  r := r || array['Teacher A (Ananda)|Org A events incl. draft (phase 8)|6', v_n::text];

  select count(*) into v_n from public.event_registrations;
  r := r || array['Teacher A (Ananda)|registrations of events Ananda hosts (phase 14)|18', v_n::text];

  r := r || array['Teacher A (Ananda)|check-in code for the QR|TALKNEXT', coalesce(public.event_checkin_code(v_ev_talk_next), 'null')];

  begin
    insert into public.event_registrations (org_id, event_id, guest_name, guest_email, status)
    values (v_org_a, v_ev_talk_next, 'Verify Guest', 'verify.guest@example.com', 'registered');
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked: ' || sqlerrm end; end;
  r := r || array['Teacher A (Ananda)|add a guest to an intro talk|allowed', v_txt];

  begin
    insert into public.event_registrations (org_id, event_id, guest_name, status)
    values (v_org_a, v_ev_full, 'One too many', 'registered');
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Teacher A (Ananda)|add a guest to a full event|blocked', v_txt];

  -- Batch editing (phase 11)
  begin
    update public.batches set name = name || ' (edited)' where id = v_autumn;
    get diagnostics v_n = row_count;
    v_txt := case when v_n = 1 then 'allowed' else 'blocked' end;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'blocked'; end if; end;
  r := r || array['Teacher A (Ananda)|edit own batch (phase 11)|allowed', v_txt];

  begin
    update public.batches set name = name || ' (edited)' where id = 'd1000000-0000-0000-0000-000000000005';
    get diagnostics v_n = row_count;
    v_txt := case when v_n = 1 then 'allowed' else 'blocked' end;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'blocked'; end if; end;
  r := r || array['Teacher A (Ananda)|edit another teacher''s batch|blocked', v_txt];

  -- Phase 12: teacher uploads study materials
  begin
    insert into storage.objects (bucket_id, name) values ('materials', v_org_a::text || '/' || v_hp_course::text || '/notes.pdf');
    insert into public.programme_materials (org_id, course_id, title, kind, storage_path)
    values (v_org_a, v_hp_course, 'Notes', 'pdf', v_org_a::text || '/' || v_hp_course::text || '/notes.pdf');
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked: ' || sqlerrm end; end;
  r := r || array['Teacher A (Ananda)|upload a study material (phase 12)|allowed', v_txt];

  begin
    insert into storage.objects (bucket_id, name) values ('materials', v_org_b::text || '/c2000000-0000-0000-0000-000000000001/x.pdf');
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Teacher A (Ananda)|upload into Org B materials|blocked', v_txt];

  -- Phase 9: CRM
  select count(*) into v_n from public.crm_contacts;
  r := r || array['Teacher A (Ananda)|sees only own leads (phase 14)|0', v_n::text];

  -- Phase 14: no wiping of programmes or practice history by a teacher
  begin
    delete from public.courses where org_id = v_org_a;
    get diagnostics v_n = row_count;
    v_txt := v_n::text;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'blocked'; end if; end;
  r := r || array['Teacher A (Ananda)|programmes deleted by a teacher (phase 14)|0', v_txt];

  begin
    perform public.delete_user_account();
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Teacher A (Ananda)|delete own account while teaching (phase 14)|blocked', v_txt];

  v_json := public.crm_funnel_report(null);
  v_txt := 'total=' || (v_json->'leads'->>'total') || ' invited=' || (v_json->'leads'->>'invited')
        || ' attended=' || (v_json->'leads'->>'attended') || ' registered=' || (v_json->'leads'->>'registered');
  r := r || array['Teacher A (Ananda)|lead funnel|total=11 invited=9 attended=4 registered=2', v_txt];
  r := r || array['Teacher A (Ananda)|journey report lists the Happiness Program|Happiness Program',
                  coalesce(v_json->'journey'->0->>'course_name', 'none')];


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
  r := r || array['Student (Aarav)|profiles visible (self + 2 teachers)|3', v_n::text];

  begin
    insert into public.checkins (org_id, student_id, batch_id, day_number, evening)
    values (v_org_a, v_student01, v_autumn, v_day, true)
    on conflict (student_id, batch_id, day_number) do update set evening = true;
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked: ' || sqlerrm end; end;
  r := r || array['Student (Aarav)|tick today''s evening (twice = update)|allowed', v_txt];

  begin
    update public.checkins set evening = not evening
    where student_id = v_student01 and batch_id = v_autumn and day_number = 5
    returning case when late then 'allowed, marked late' else 'allowed, not marked late' end into v_txt;
    if v_txt is null then v_txt := 'no row'; end if;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'blocked'; end if; end;
  r := r || array['Student (Aarav)|change a past day (day 5) (phase 11)|allowed, marked late', v_txt];

  begin
    insert into public.checkins (org_id, student_id, batch_id, day_number, morning)
    values (v_org_a, v_student01, v_autumn, v_day + 1, true);
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|check in for tomorrow|blocked', v_txt];

  begin
    insert into public.checkins (org_id, student_id, batch_id, day_number, morning)
    values (v_org_a, 'd0000000-0000-0000-0000-000000000002', v_autumn, 5, true)
    on conflict (student_id, batch_id, day_number) do update set morning = true;
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|tick another student''s day|blocked', v_txt];

  select count(*) into v_n from public.enrolments where student_id = v_student01;
  r := r || array['Student (Aarav)|own programmes (HP x2, Silence, VTP)|4', v_n::text];

  begin
    insert into public.checkins (org_id, student_id, batch_id, day_number, morning)
    values (v_org_a, v_student01, v_vtp, 4, true);
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|daily check-in on VTP (no practice track)|blocked', v_txt];

  begin
    insert into public.courses (org_id, name, category, has_practice_track, duration_days)
    values (v_org_a, 'Student Programme', 'Test', false, 40);
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|add a programme|blocked', v_txt];

  select count(*) into v_n from public.lesson_modules;
  r := r || array['Student (Aarav)|modules of own programmes (HP 4, Silence 2)|6', v_n::text];

  select count(*) into v_n from public.lessons where module_id is not null;
  r := r || array['Student (Aarav)|open module lessons (locked ones hidden)|7', v_n::text];

  select count(*) into v_n from public.lesson_progress where student_id <> v_student01;
  r := r || array['Student (Aarav)|other students'' lesson progress visible|0', v_n::text];

  begin
    insert into public.lesson_progress (org_id, student_id, lesson_id) values (v_org_a, v_student01, v_lesson_deeper);
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|complete a lesson in a locked module|blocked', v_txt];

  begin
    insert into public.lesson_progress (org_id, student_id, lesson_id) values (v_org_a, v_student01, v_lesson_week2);
    select count(*) into v_n from public.lessons where id = v_lesson_deeper;
    v_txt := case when v_n = 1 then 'opens' else 'stays locked' end;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Student (Aarav)|finishing Week 2 opens "Going deeper"|opens', v_txt];

  begin
    insert into public.lesson_modules (org_id, course_id, title) values (v_org_a, v_hp_course, 'Student module');
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|add a module|blocked', v_txt];

  select count(*) into v_n from public.followup_records;
  r := r || array['Student (Aarav)|follow-up records and notes visible|0', v_n::text];

  select count(*) into v_n from public.followup_steps;
  r := r || array['Student (Aarav)|follow-up plan steps visible (reminders)|8', v_n::text];

  select count(*) into v_n from public.my_batch_sessions(v_autumn);
  r := r || array['Student (Aarav)|own batch follow-up sessions|2', v_n::text];

  select count(*) into v_n from public.my_batch_sessions(v_moon);
  r := r || array['Student (Aarav)|sessions of a batch he is not in|0', v_n::text];

  begin
    insert into public.followup_steps (org_id, course_id, kind, title, offset_day)
    values (v_org_a, v_hp_course, 'reminder', 'Student reminder', 5);
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|add a follow-up plan step|blocked', v_txt];

  select count(*) into v_n from public.events;
  r := r || array['Student (Aarav)|published events visible (no draft)|5', v_n::text];

  select count(*) into v_n from public.event_registrations;
  r := r || array['Student (Aarav)|registrations visible (own only)|1', v_n::text];

  begin
    execute 'select checkin_code from public.events limit 1' into v_txt;
    v_txt := 'readable';
  exception when others then v_txt := 'hidden'; end;
  r := r || array['Student (Aarav)|event check-in codes|hidden', v_txt];

  begin
    v_txt := public.register_for_event(v_ev_talk_next)->>'success';
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Student (Aarav)|register for the next intro talk|true', v_txt];

  begin
    v_txt := public.register_for_event(v_ev_full)->>'success';
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Student (Aarav)|register for a full event|false', v_txt];

  begin
    v_txt := public.register_for_event(v_ev_talk_past)->>'success';
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Student (Aarav)|register for a past event|false', v_txt];

  begin
    v_txt := public.check_in_to_event('NOWCHECK')->>'success';
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Student (Aarav)|QR check-in to the event happening now|true', v_txt];

  begin
    v_txt := public.check_in_to_event('TALKNEXT')->>'success';
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Student (Aarav)|QR check-in 3 days before the event|false', v_txt];

  begin
    v_txt := public.check_in_to_event('BREATHB1')->>'success';
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Student (Aarav)|QR check-in to an Org B event|false', v_txt];

  begin
    insert into public.event_registrations (org_id, event_id, profile_id, status)
    values (v_org_a, v_ev_full, v_student01, 'attended');
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|write a registration directly|blocked', v_txt];

  begin
    insert into public.events (org_id, title, starts_at) values (v_org_a, 'Student event', now() + interval '1 day');
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|create an event|blocked', v_txt];

  -- Phase 12: study materials and profile pictures
  select count(*) into v_n from public.programme_materials where id::text like 'e6000000-%';
  r := r || array['Student (Aarav)|study materials of own programmes (HP 2, Silence 1; draft hidden)|3', v_n::text];

  begin
    insert into public.programme_materials (org_id, course_id, title, kind, url)
    values (v_org_a, v_hp_course, 'Student upload', 'link', 'https://example.com');
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|add a study material|blocked', v_txt];

  select count(*) into v_n from storage.objects
  where bucket_id = 'materials' and name in (v_org_a::text || '/' || v_hp_course::text || '/verify-a.pdf', v_org_a::text || '/c1000000-0000-0000-0000-000000000004/verify-b.pdf');
  r := r || array['Student (Aarav)|material files visible (own programme only)|1', v_n::text];

  begin
    insert into storage.objects (bucket_id, name) values ('materials', v_org_a::text || '/' || v_hp_course::text || '/student.pdf');
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|upload a material file|blocked', v_txt];

  -- Phase 13: roles are given by an admin only
  begin
    update public.profiles set roles = array['student', 'admin'] where id = v_student01;
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|give self the admin role|blocked', v_txt];

  -- Phase 14: consent is written by the app's function only
  begin
    update public.profiles set consent_at = '2000-01-01' where id = v_student01;
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|back-date own consent (phase 14)|blocked', v_txt];

  -- Phase 14: the app saves one tick at a time; an Evening tick keeps the Morning tick
  begin
    insert into public.checkins (org_id, batch_id, student_id, day_number, morning)
    values (v_org_a, v_autumn, v_student01, 1, true)
    on conflict (student_id, batch_id, day_number) do update set morning = excluded.morning;
    insert into public.checkins (org_id, batch_id, student_id, day_number, evening)
    values (v_org_a, v_autumn, v_student01, 1, true)
    on conflict (student_id, batch_id, day_number) do update set evening = excluded.evening;
    insert into public.checkins (org_id, batch_id, student_id, day_number, morning)
    values (v_org_a, v_autumn, v_student01, 2, false)
    on conflict (student_id, batch_id, day_number) do update set morning = excluded.morning;
    select 'morning=' || morning || ' evening=' || evening into v_txt
    from public.checkins where student_id = v_student01 and batch_id = v_autumn and day_number = 1;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Student (Aarav)|tick Morning, then Evening separately (phase 14)|morning=true evening=true', v_txt];

  select count(*) into v_n from storage.objects where bucket_id = 'materials' and name like '%/verify-draft.pdf';
  r := r || array['Student (Aarav)|hidden study file visible (phase 14)|0', v_n::text];

  begin
    for v_n in 1..11 loop
      v_json := public.join_batch_by_code('WRONG' || v_n);
    end loop;
    v_txt := case when v_json->>'message' like 'Too many%' then 'limited' else 'not limited' end;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Student (Aarav)|11 wrong join codes in a row (phase 14)|limited', v_txt];

  begin
    insert into storage.objects (bucket_id, name) values ('avatars', v_student01::text || '/avatar.jpg');
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|upload own profile picture|allowed', v_txt];

  begin
    insert into storage.objects (bucket_id, name) values ('avatars', v_ananda::text || '/avatar.jpg');
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|replace someone else''s profile picture|blocked', v_txt];

  begin
    update public.profiles set avatar_url = 'https://tracker.example.com/pixel.png' where id = v_student01;
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Student (Aarav)|use a picture from any website|blocked', v_txt];

  select count(*) into v_n from public.crm_contacts;
  r := r || array['Student (Aarav)|CRM leads visible|0', v_n::text];

  v_txt := public.crm_invite_to_event(v_lead_rania, v_ev_talk_next)->>'success';
  r := r || array['Student (Aarav)|invite a lead to an event|false', v_txt];

  reset role;

  -- ------------------------------------------------------------------ Volunteer A (Ravi, phase 9)
  perform set_config('request.jwt.claims', json_build_object('sub', v_ravi, 'email', 'volunteer.ravi@example.com', 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into v_n from public.crm_contacts;
  r := r || array['Volunteer (Ravi)|sees only own leads|6', v_n::text];

  select count(*) into v_n from public.crm_contacts where id = v_lead_sara;
  r := r || array['Volunteer (Ravi)|sees another volunteer''s lead|0', v_n::text];

  select count(*) into v_n from public.crm_activities;
  r := r || array['Volunteer (Ravi)|activities visible (own leads only)|4', v_n::text];

  select count(*) into v_n from public.event_registrations;
  r := r || array['Volunteer (Ravi)|event registrations visible|0', v_n::text];

  -- Only the seeded batches: real batches made in the app are left out of the checks
  select string_agg(name, ', ' order by start_date) into v_txt from public.crm_open_batches() where id::text like 'd1000000-%';
  r := r || array['Volunteer (Ravi)|batches he can register leads for|VTP – October, New Moon Mindfulness', coalesce(v_txt, 'none')];

  -- Phase 14: a new lead does not reveal whether the email has an account,
  -- and an existing member is not enrolled by a volunteer
  begin
    insert into public.crm_contacts (org_id, full_name, email, source, owner_id, created_by)
    values (v_org_a, 'Verify Member', 'student02@example.com', 'friend', v_ravi, v_ravi)
    returning coalesce(profile_id::text, 'not linked') into v_txt;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Volunteer (Ravi)|lead with a member''s email shows the account (phase 14)|not linked', v_txt];

  begin
    insert into public.crm_contacts (org_id, full_name, email, source, owner_id, created_by)
    values (v_org_a, 'Verify Member', 'student02@example.com', 'friend', v_ravi, v_ravi)
    returning id::text into v_txt;
    v_json := public.crm_register_for_batch(v_txt::uuid, v_moon);
    v_txt := case when (v_json->>'success')::boolean then 'enrolled' else 'link sent instead' end;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Volunteer (Ravi)|enrol an existing member (phase 14)|link sent instead', v_txt];

  begin
    insert into public.crm_contacts (org_id, full_name, owner_id, created_by) values (v_org_a, 'New friend', v_ravi, v_ravi);
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Volunteer (Ravi)|add a lead for himself|allowed', v_txt];

  begin
    insert into public.crm_contacts (org_id, full_name, owner_id, created_by) values (v_org_a, 'Sneaky', v_sara, v_ravi);
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Volunteer (Ravi)|add a lead owned by someone else|blocked', v_txt];

  begin
    update public.crm_contacts set owner_id = v_sara where id = v_lead_joel;
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Volunteer (Ravi)|hand his lead to another volunteer|blocked', v_txt];

  begin
    update public.crm_contacts set profile_id = v_student01 where id = v_lead_joel returning coalesce(profile_id::text, 'not linked') into v_txt;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Volunteer (Ravi)|link his lead to any account by hand|not linked', v_txt];

  begin
    v_txt := public.crm_invite_to_event(v_lead_joel, v_ev_talk_next)->>'success';
    v_txt := v_txt || ' / ' || (select stage from public.crm_contacts where id = v_lead_joel);
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Volunteer (Ravi)|invite his lead to the intro talk|true / invited', v_txt];

  begin
    v_txt := public.crm_invite_to_event(v_lead_sara, v_ev_talk_next)->>'success';
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Volunteer (Ravi)|invite another volunteer''s lead|false', v_txt];

  begin
    v_txt := public.crm_register_for_batch(v_lead_hiro, v_moon)->>'success';
    v_txt := v_txt || ' / ' || (select stage from public.crm_contacts where id = v_lead_hiro);
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Volunteer (Ravi)|register his lead for a Happiness Program batch|true / registered', v_txt];

  v_txt := coalesce(public.crm_funnel_report(null)->>'success', 'null');
  r := r || array['Volunteer (Ravi)|open the funnel report|false', v_txt];

  begin
    update public.profiles set role = 'teacher' where id = v_ravi;
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Volunteer (Ravi)|make himself a teacher|blocked', v_txt];

  reset role;

  -- ------------------------------------------------------------------ Lead signs up (phase 9)
  begin
    insert into public.profiles (id, org_id, email, full_name, role)
    values ('a9000000-0000-0000-0000-000000000001', v_org_a, 'grace.liu@example.com', 'Grace Liu', 'student');
    insert into public.enrolments (org_id, batch_id, student_id, source)
    values (v_org_a, v_moon, 'a9000000-0000-0000-0000-000000000001', 'code');
    select case when profile_id is not null then 'linked' else 'not linked' end || ' / ' || stage
    into v_txt from public.crm_contacts where id = v_lead_grace;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Lead (Grace)|signs up and joins a batch|linked / registered', v_txt];

  -- ------------------------------------------------------------------ Admin A
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_a, 'email', 'admin.sadhana@example.com', 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into v_n from public.batches where id::text like 'd1000000-%';
  r := r || array['Admin A|sees all seeded Org A batches|5', v_n::text];

  execute v_sql_foreign into v_n using v_org_b;
  r := r || array['Admin A|rows visible from Org B (all tables)|0', v_n::text];

  -- Phase 14: admins see every lead; the lead journey still moves
  select count(*) into v_n from public.crm_contacts where id::text like 'e5000000-%' and org_id = v_org_a;
  r := r || array['Admin A|sees every seeded Org A lead|11', v_n::text];

  begin
    update public.event_registrations set status = 'attended'
    where event_id = v_ev_talk_next and contact_id = v_lead_rania;
    select stage into v_txt from public.crm_contacts where id = v_lead_rania;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'error: ' || sqlerrm; end if; end;
  r := r || array['Admin A|marking a lead attended moves the lead to attended|attended', v_txt];

  begin
    delete from public.batches where id = v_autumn;
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Admin A|delete a batch that has check-ins (phase 14)|blocked', v_txt];

  begin
    insert into public.programme_materials (org_id, course_id, title, kind, storage_path)
    values (v_org_a, v_hp_course, 'Elsewhere', 'pdf', v_org_b::text || '/x/secret.pdf');
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Admin A|study file outside its programme folder (phase 14)|blocked', v_txt];

  begin
    update public.lessons set video_url = 'javascript:alert(1)' where org_id = v_org_a and id = v_lesson_week2;
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Admin A|lesson video link that is not https (phase 14)|blocked', v_txt];

  -- Phase 13: several roles per person
  v_txt := 'error';
  begin
    update public.profiles set roles = array['volunteer', 'student'] where id = 'd0000000-0000-0000-0000-000000000002'
    returning array_to_string(roles, ',') || ' -> ' || role into v_txt;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'blocked: ' || sqlerrm; end if; end;
  r := r || array['Admin A|give a student a second role (volunteer)|student,volunteer -> volunteer', v_txt];

  begin
    update public.profiles set roles = array['teacher'] where id = v_admin_a;
    raise exception 'PROBE_WROTE';
  exception when others then v_txt := case when sqlerrm = 'PROBE_WROTE' then 'allowed' else 'blocked' end; end;
  r := r || array['Admin A|remove own admin role|blocked', v_txt];

  v_txt := 'error';
  begin
    update public.profiles set roles = array['admin', 'teacher', 'volunteer', 'student'] where id = v_admin_a
    returning array_to_string(roles, ',') || ' -> ' || role into v_txt;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'blocked: ' || sqlerrm; end if; end;
  r := r || array['Admin A|give self every role|student,volunteer,teacher,admin -> admin', v_txt];

  v_txt := 'error';
  begin
    insert into public.role_grants (org_id, email, roles) values (v_org_a, 'verify.multi@example.com', array['teacher', 'volunteer'])
    returning array_to_string(roles, ',') || ' -> ' || role into v_txt;
    raise exception 'PROBE_DONE';
  exception when others then if sqlerrm <> 'PROBE_DONE' then v_txt := 'blocked: ' || sqlerrm; end if; end;
  r := r || array['Admin A|invite an email with two roles|volunteer,teacher -> teacher', v_txt];

  reset role;

  -- ------------------------------------------------------------------ Anonymous
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  begin
    select count(*) into v_n from public.checkins;
    v_txt := v_n::text;
  exception when others then v_txt := '0'; end;
  r := r || array['Anonymous visitor|check-ins visible|0', v_txt];
  begin
    select count(*) into v_n from public.crm_contacts;
    v_txt := v_n::text;
  exception when others then v_txt := '0'; end;
  r := r || array['Anonymous visitor|CRM leads visible|0', v_txt];
  begin
    select count(*) into v_n from public.profiles;
    v_txt := 'readable';
  exception when others then v_txt := 'blocked'; end;
  r := r || array['Anonymous visitor|read profiles table (phase 14)|blocked', v_txt];
  begin
    select count(*) into v_n from public.organisations where slug = 'sadhana-mandala';
    v_txt := v_n::text;
  exception when others then v_txt := 'blocked'; end;
  r := r || array['Anonymous visitor|organisation name for the sign-in page|1', v_txt];
  v_txt := coalesce(public.batch_join_preview('autumn23')->>'batch_name', 'none');
  r := r || array['Anonymous visitor|batch QR shows the batch before sign-in|Autumn Awakening Cohort', v_txt];
  reset role;

  -- ------------------------------------------------------------------ Database rules (phase 14)
  begin
    update public.profiles set roles = array['teacher'] where email = 'admin.prana@example.com';
    v_txt := 'allowed';
  exception when others then v_txt := 'blocked'; end;
  r := r || array['Rules|remove the only admin of Org B|blocked', v_txt];

  select count(*) into v_n from pg_proc where proname = 'set_my_role' and pronamespace = 'public'::regnamespace;
  r := r || array['Rules|unsafe set_my_role function absent|0', v_n::text];

  select count(*) into v_n from pg_policies
  where schemaname = 'public' and tablename <> 'organisations' and (qual = 'true' or with_check = 'true') and permissive = 'PERMISSIVE';
  r := r || array['Rules|open "true" policies outside organisations|0', v_n::text];

  raise exception 'VERIFY_UNDO';
  exception when others then
    if sqlerrm <> 'VERIFY_UNDO' then raise; end if;
  end;

  -- ------------------------------------------------------------------ Results
  for i in 1 .. array_length(r, 1) / 2 loop
    insert into phase4_results (persona, check_name, expected, actual, result)
    select split_part(r[2*i-1], '|', 1), split_part(r[2*i-1], '|', 2), split_part(r[2*i-1], '|', 3), r[2*i],
           case when split_part(r[2*i-1], '|', 3) = r[2*i] then 'PASS' else 'FAIL' end;
  end loop;
end;
$$;

select persona, check_name, expected, actual, result from phase4_results order by n;
