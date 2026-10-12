-- ============================================================================
-- Sadhana Mandala: dummy data seed (SPEC.md phases 4 and 5)
--
-- Organisation A "Sadhana Mandala":
--   Phase 4: the Happiness Program with its 40-Day Sadhana practice track,
--   3 Happiness Program batches (finished at day 40, day 23, day 2), 30
--   clearly fictional students with example.com emails and varied
--   check-ins, including 5 quiet students.
--   Phase 5: the starting AOL programme catalogue (editable on screen) and
--   2 more batches so students 1-5 show a multi-programme journey:
--   Happiness Program -> Art of Silence (finished, students 1-10) -> VTP
--   (running, students 1-5). Neither has a daily practice track.
--   Phase 6: placeholder learning modules for the Happiness Program (4
--   modules: always open, day 1, day 8, after the previous one) and Art of
--   Silence (2 modules), and lesson progress for students 1-10.
--   Phase 7: follow-up plans for the Happiness Program (2 sessions, 2
--   personal check-ins, 2 reminders) and Art of Silence (1 session, 1
--   personal follow-up), with records for Autumn Awakening: day-3 calls done
--   for students 1-20, day-15 calls for 1-10, the day-8 session held and the
--   day-22 session held.
--   Phase 8: events: an intro talk in 3 days (6 guests and 2 members
--   registered), a past intro talk (5 attended, 2 no-show, 1 cancelled), a
--   satsang in 7 days (students 1-10), a small group that is full (2 of 2),
--   a draft, an event happening now (for testing QR check-in) and one Org B
--   event. Check-in codes are fixed so they can be tested.
-- Organisation B "Prana Flow Academy": different name and colours,
--   show_powered_by false, 1 batch, 5 students.
--
-- Re-runnable: every run first removes earlier dummy data (all @example.com
-- profiles in these two organisations and the seeded batches), then recreates
-- it with dates relative to TODAY in the organisation timezone. Run it again
-- on the morning of a demo so the batches sit on day 23 / day 2 / finished.
--
-- Real accounts are never deleted or changed by this script.
-- Run supabase/phase4_security.sql, supabase/phase5_programmes.sql,
-- supabase/phase6_lms.sql, supabase/phase7_followups.sql and
-- supabase/phase8_events.sql first,
-- and supabase/verify.sql after.
--
-- Expected teacher dashboard for "Autumn Awakening" (day 23 of 40):
--   Done 6 · Rest 2 · Not yet 2 · No answer 20 · Quiet 5 · 30 students
-- ============================================================================

-- Dummy profiles have no Google sign-in account behind them
alter table public.profiles drop constraint if exists profiles_id_fkey;

do $$
declare
  v_org_a_id uuid;
  v_org_b_id uuid;
  v_today_a date;
  v_today_b date;

  v_course_a_id uuid := 'c1000000-0000-0000-0000-000000000001';
  v_course_b_id uuid := 'c2000000-0000-0000-0000-000000000001';
  -- Rest of the AOL catalogue (Org A)
  v_prog_silence_id uuid := 'c1000000-0000-0000-0000-000000000002';
  v_prog_ssm_id     uuid := 'c1000000-0000-0000-0000-000000000003';
  v_prog_yoga_id    uuid := 'c1000000-0000-0000-0000-000000000004';
  v_prog_vtp_id     uuid := 'c1000000-0000-0000-0000-000000000005';
  v_prog_amp_id     uuid := 'c1000000-0000-0000-0000-000000000006';

  v_teacher_a1_id uuid := 'b0000000-0000-0000-0000-000000000001'; -- Ananda Sharma
  v_teacher_a2_id uuid := 'b0000000-0000-0000-0000-000000000002'; -- Priya Patel
  v_admin_a_id    uuid := 'b0000000-0000-0000-0000-000000000003';
  v_teacher_b_id  uuid := 'c0000000-0000-0000-0000-000000000001'; -- Marcus Vance
  v_admin_b_id    uuid := 'c0000000-0000-0000-0000-000000000002';

  v_batch_day23_id uuid := 'd1000000-0000-0000-0000-000000000001'; -- Autumn Awakening
  v_batch_day40_id uuid := 'd1000000-0000-0000-0000-000000000002'; -- Summer Solstice (finished)
  v_batch_day2_id  uuid := 'd1000000-0000-0000-0000-000000000003'; -- New Moon
  v_batch_old_day1 uuid := 'd1000000-0000-0000-0000-000000000004'; -- removed (not in SPEC)
  v_batch_b_id     uuid := 'd2000000-0000-0000-0000-000000000001'; -- Prana Sunrise
  v_batch_silence_id uuid := 'd1000000-0000-0000-0000-000000000005'; -- Art of Silence (finished)
  v_batch_vtp_id     uuid := 'd1000000-0000-0000-0000-000000000006'; -- VTP (running)

  -- Learning modules (Phase 6)
  v_mod_hp_before  uuid := 'f1000000-0000-0000-0000-000000000001';
  v_mod_hp_week1   uuid := 'f1000000-0000-0000-0000-000000000002';
  v_mod_hp_week2   uuid := 'f1000000-0000-0000-0000-000000000003';
  v_mod_hp_deeper  uuid := 'f1000000-0000-0000-0000-000000000004';
  v_mod_aos_prep   uuid := 'f1000000-0000-0000-0000-000000000005';
  v_mod_aos_after  uuid := 'f1000000-0000-0000-0000-000000000006';

  -- Follow-up plan steps (Phase 7)
  v_fu_hp_rem1   uuid := 'e3000000-0000-0000-0000-000000000001';
  v_fu_hp_call1  uuid := 'e3000000-0000-0000-0000-000000000002';
  v_fu_hp_sess1  uuid := 'e3000000-0000-0000-0000-000000000003';
  v_fu_hp_call2  uuid := 'e3000000-0000-0000-0000-000000000004';
  v_fu_hp_rem2   uuid := 'e3000000-0000-0000-0000-000000000005';
  v_fu_hp_sess2  uuid := 'e3000000-0000-0000-0000-000000000006';
  v_fu_aos_call  uuid := 'e3000000-0000-0000-0000-000000000007';
  v_fu_aos_sess  uuid := 'e3000000-0000-0000-0000-000000000008';

  -- Events (Phase 8)
  v_ev_talk_next uuid := 'e4000000-0000-0000-0000-000000000001';
  v_ev_talk_past uuid := 'e4000000-0000-0000-0000-000000000002';
  v_ev_satsang   uuid := 'e4000000-0000-0000-0000-000000000003';
  v_ev_full      uuid := 'e4000000-0000-0000-0000-000000000004';
  v_ev_draft     uuid := 'e4000000-0000-0000-0000-000000000005';
  v_ev_org_b     uuid := 'e4000000-0000-0000-0000-000000000006';
  v_ev_now       uuid := 'e4000000-0000-0000-0000-000000000007';
  v_tz text;

  v_names text[] := array[
    'Aarav Mehta', 'Maya Lin', 'Leo Dubois', 'Elena Rostova', 'Fatima Al-Mansoori',
    'David Kim', 'Aisha Bello', 'Carlos Mendoza', 'Zoe Jenkins', 'Vikram Rao',
    'Sarah Connor', 'Kenji Takahashi', 'Chloe Martin', 'Tariq Al-Hashimi', 'Sofia Rossi',
    'Lucas Silva', 'Amara Okafor', 'Liam O''Connor', 'Meera Krishnan', 'Jonas Mueller',
    'Layla Haddad', 'Gabriel Santos', 'Nina Petrova', 'Ethan Wright', 'Kavita Sharma',
    'Oliver Hansen', 'Yasmin Noor', 'Alexander Petrov', 'Hannah Abbott', 'Daniel Vance'
  ];
  v_b_names text[] := array['Arjun Nair', 'Beatrice Taylor', 'Cyrus Chen', 'Daphne Brooks', 'Emre Kaya'];

  v_student_id uuid;
  i integer;
  d integer;
  v_status text;
begin
  -- --------------------------------------------------------------------------
  -- Organisations
  -- --------------------------------------------------------------------------
  insert into public.organisations (
    name, slug, app_name, primary_colour, accent_colour,
    support_email, checkin_question, footer_text, timezone, show_powered_by
  ) values (
    'Sadhana Mandala', 'sadhana-mandala', 'Sadhana Mandala', '#1c1917', '#059669',
    'support@zyxenai.com', 'Did you complete your daily practice today?',
    'Mindful daily practice and teacher guidance', 'Asia/Dubai', true
  )
  on conflict (slug) do update set show_powered_by = true
  returning id into v_org_a_id;

  insert into public.organisations (
    name, slug, app_name, primary_colour, accent_colour,
    support_email, checkin_question, footer_text, timezone, show_powered_by
  ) values (
    'Prana Flow Academy', 'prana-flow', 'Prana Flow', '#0f172a', '#d97706',
    'support@pranaflow.example.com', 'Have you practised your mindful breathing today?',
    'Dedicated to conscious breath and vibrant presence', 'Asia/Dubai', false
  )
  on conflict (slug) do update set
    name = excluded.name, app_name = excluded.app_name,
    primary_colour = excluded.primary_colour, accent_colour = excluded.accent_colour,
    show_powered_by = false
  returning id into v_org_b_id;

  select (now() at time zone timezone)::date into v_today_a from public.organisations where id = v_org_a_id;
  select (now() at time zone timezone)::date into v_today_b from public.organisations where id = v_org_b_id;

  -- --------------------------------------------------------------------------
  -- Reset earlier dummy data (cascades to enrolments, check-ins, invites)
  -- --------------------------------------------------------------------------
  delete from public.batches
  where id in (v_batch_day23_id, v_batch_day40_id, v_batch_day2_id, v_batch_old_day1, v_batch_b_id,
               v_batch_silence_id, v_batch_vtp_id);

  -- Batches a dummy teacher still owns (from older seed versions)
  delete from public.batches b
  using public.profiles p
  where p.id = b.teacher_id and p.org_id in (v_org_a_id, v_org_b_id) and p.email like '%example.com';

  delete from public.batch_invites where org_id in (v_org_a_id, v_org_b_id) and email like '%example.com';
  -- Seeded events (their registrations cascade)
  delete from public.events
  where id in (v_ev_talk_next, v_ev_talk_past, v_ev_satsang, v_ev_full, v_ev_draft, v_ev_org_b, v_ev_now);

  -- Seeded follow-up steps (their records cascade)
  delete from public.followup_steps
  where id in (v_fu_hp_rem1, v_fu_hp_call1, v_fu_hp_sess1, v_fu_hp_call2, v_fu_hp_rem2, v_fu_hp_sess2, v_fu_aos_call, v_fu_aos_sess);

  -- Seeded learning modules (their lessons and progress cascade)
  delete from public.lesson_modules
  where id in (v_mod_hp_before, v_mod_hp_week1, v_mod_hp_week2, v_mod_hp_deeper, v_mod_aos_prep, v_mod_aos_after);

  delete from public.lessons where org_id in (v_org_a_id, v_org_b_id)
    and author_id in (v_teacher_a1_id, v_teacher_a2_id, v_teacher_b_id);
  delete from public.profiles where org_id in (v_org_a_id, v_org_b_id) and email like '%example.com';
  delete from public.role_grants where org_id in (v_org_a_id, v_org_b_id) and email like '%example.com';

  -- Duplicate seeded courses that no batch uses any more
  delete from public.courses c
  where c.org_id in (v_org_a_id, v_org_b_id)
    and c.id not in (v_course_a_id, v_course_b_id)
    and c.name in ('40-Day Sadhana Practice', '21-Day Mindfulness Starter', 'Prana Foundation 30')
    and not exists (select 1 from public.batches b where b.course_id = c.id);

  -- --------------------------------------------------------------------------
  -- Programmes (the `courses` table is the programme catalogue)
  -- --------------------------------------------------------------------------
  -- Happiness Program: the only Org A programme with a daily practice track.
  -- Always reset, because the Phase 4 dashboard numbers depend on it.
  insert into public.courses (id, org_id, name, code, category, description, programme_days,
                              has_practice_track, practice_name, duration_days, sort_order, is_active)
  values (v_course_a_id, v_org_a_id, 'Happiness Program', 'HP', 'Core programme',
          'Introductory programme with breathing, meditation and wisdom, followed by a 40-day daily practice.',
          3, true, '40-Day Sadhana', 40, 10, true)
  on conflict (id) do update set
    org_id = excluded.org_id, name = excluded.name, code = excluded.code, category = excluded.category,
    description = excluded.description, programme_days = excluded.programme_days,
    has_practice_track = true, practice_name = excluded.practice_name, duration_days = 40,
    sort_order = excluded.sort_order, is_active = true, prerequisite_ids = '{}';

  -- The rest of the starting catalogue. Inserted once and then left alone, so
  -- changes made on the Programmes screen survive a re-run of this script.
  insert into public.courses (id, org_id, name, code, category, description, programme_days,
                              has_practice_track, duration_days, prerequisite_ids, sort_order, is_active)
  values
    (v_prog_silence_id, v_org_a_id, 'Art of Silence', 'AOS', 'Advanced programme',
     'Residential silence programme that deepens the Happiness Program practices.',
     null, false, 40, array[v_course_a_id], 20, true),
    (v_prog_ssm_id, v_org_a_id, 'Sahaj Samadhi Meditation', 'SSM', 'Meditation',
     'Meditation programme.', null, false, 40, '{}', 30, true),
    (v_prog_yoga_id, v_org_a_id, 'Sri Sri Yoga', 'SSY', 'Yoga',
     'Yoga programme.', null, false, 40, '{}', 40, true),
    (v_prog_vtp_id, v_org_a_id, 'Volunteer Training Program', 'VTP', 'Volunteer programme',
     'Training for volunteers who want to serve and share the programmes.',
     null, false, 40, array[v_course_a_id], 50, true),
    (v_prog_amp_id, v_org_a_id, 'Advanced Meditation Program', 'AMP', 'Advanced programme',
     'Advanced meditation programme.', null, false, 40, array[v_course_a_id], 60, true)
  on conflict do nothing;

  insert into public.courses (id, org_id, name, code, category, description, programme_days,
                              has_practice_track, practice_name, duration_days, sort_order, is_active)
  values (v_course_b_id, v_org_b_id, 'Prana Foundation 30', 'PF30', 'Core programme',
          'Pranayama breathwork over 30 days.', null, true, '30-Day Breath Practice', 30, 10, true)
  on conflict (id) do update set
    org_id = excluded.org_id, name = excluded.name, code = excluded.code,
    has_practice_track = true, practice_name = excluded.practice_name, duration_days = 30, is_active = true;

  -- Older seed versions used a non-example.com dummy admin (never a real sign-in)
  delete from public.profiles p
  where p.email = 'admin@sadhana.zyxenai.com' and not exists (select 1 from auth.users u where u.id = p.id);
  delete from public.role_grants where email = 'admin@sadhana.zyxenai.com';

  -- --------------------------------------------------------------------------
  -- Teachers and admins (all fictional)
  -- --------------------------------------------------------------------------
  insert into public.profiles (id, org_id, email, full_name, role, consent_at) values
    (v_teacher_a1_id, v_org_a_id, 'teacher.ananda@example.com',   'Ananda Sharma', 'teacher', now() - interval '60 days'),
    (v_teacher_a2_id, v_org_a_id, 'teacher.priya@example.com',    'Priya Patel',   'teacher', now() - interval '60 days'),
    (v_admin_a_id,    v_org_a_id, 'admin.sadhana@example.com',    'Sadhana Admin', 'admin',   now() - interval '60 days'),
    (v_teacher_b_id,  v_org_b_id, 'teacher.marcus@example.com',   'Marcus Vance',  'teacher', now() - interval '30 days'),
    (v_admin_b_id,    v_org_b_id, 'admin.prana@example.com',      'Prana Admin',   'admin',   now() - interval '30 days')
  on conflict (id) do update set
    org_id = excluded.org_id, email = excluded.email, full_name = excluded.full_name, role = excluded.role;

  insert into public.role_grants (org_id, email, role) values
    (v_org_a_id, 'teacher.ananda@example.com', 'teacher'),
    (v_org_a_id, 'teacher.priya@example.com',  'teacher'),
    (v_org_a_id, 'admin.sadhana@example.com',  'admin'),
    (v_org_b_id, 'teacher.marcus@example.com', 'teacher'),
    (v_org_b_id, 'admin.prana@example.com',    'admin')
  on conflict (org_id, email) do update set role = excluded.role;

  -- --------------------------------------------------------------------------
  -- Batches: Org A finished (day 41 today, ran 40 days), day 23, day 2; Org B day 10
  -- --------------------------------------------------------------------------
  insert into public.batches (id, org_id, course_id, teacher_id, name, start_date, join_code) values
    (v_batch_day40_id, v_org_a_id, v_course_a_id, v_teacher_a1_id, 'Summer Solstice Sadhana',  v_today_a - 40, 'SUMMER40'),
    (v_batch_day23_id, v_org_a_id, v_course_a_id, v_teacher_a1_id, 'Autumn Awakening Cohort',  v_today_a - 22, 'AUTUMN23'),
    (v_batch_day2_id,  v_org_a_id, v_course_a_id, v_teacher_a2_id, 'New Moon Mindfulness',     v_today_a - 1,  'MOON02'),
    (v_batch_b_id,     v_org_b_id, v_course_b_id, v_teacher_b_id,  'Prana Sunrise Cohort',     v_today_b - 9,  'PRANA10'),
    (v_batch_silence_id, v_org_a_id, v_prog_silence_id, v_teacher_a2_id, 'Art of Silence – September', v_today_a - 25, 'SILENCE09'),
    (v_batch_vtp_id,     v_org_a_id, v_prog_vtp_id,     v_teacher_a2_id, 'VTP – October',              v_today_a - 3,  'VTP10');

  -- --------------------------------------------------------------------------
  -- Org A: 30 students
  --   1-30  -> Autumn Awakening (day 23)
  --   1-15  -> also Summer Solstice (finished)
  --   16-20 -> also New Moon (day 2)
  -- --------------------------------------------------------------------------
  for i in 1..30 loop
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;

    insert into public.profiles (id, org_id, email, full_name, role, consent_at)
    values (v_student_id, v_org_a_id, 'student' || lpad(i::text, 2, '0') || '@example.com',
            v_names[i], 'student', now() - interval '45 days');

    insert into public.enrolments (org_id, batch_id, student_id, source, joined_at)
    values (v_org_a_id, v_batch_day23_id, v_student_id,
            (array['invite', 'code', 'manual'])[1 + i % 3], (v_today_a - 23)::timestamptz);

    if i <= 15 then
      insert into public.enrolments (org_id, batch_id, student_id, source, joined_at)
      values (v_org_a_id, v_batch_day40_id, v_student_id, 'code', (v_today_a - 41)::timestamptz);
    end if;

    if i between 16 and 20 then
      insert into public.enrolments (org_id, batch_id, student_id, source, joined_at)
      values (v_org_a_id, v_batch_day2_id, v_student_id, 'invite', (v_today_a - 2)::timestamptz);
    end if;

    -- Multi-programme journey: 1-10 did Art of Silence, 1-5 are now in VTP
    if i <= 10 then
      insert into public.enrolments (org_id, batch_id, student_id, source, joined_at)
      values (v_org_a_id, v_batch_silence_id, v_student_id, 'code', (v_today_a - 26)::timestamptz);
    end if;
    if i <= 5 then
      insert into public.enrolments (org_id, batch_id, student_id, source, joined_at)
      values (v_org_a_id, v_batch_vtp_id, v_student_id, 'invite', (v_today_a - 4)::timestamptz);
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- Autumn Awakening check-ins (today = day 23)
  --   1-15  steady: every day 1-22 (even numbers rest on days 7, 14, 21)
  --         today: 1-8 answered (4 and 8 rest, rest done), 9-10 "not yet"
  --   16-25 mixed: some missed days, rest and not-yet answers; all answered day 22
  --   26-30 QUIET: last check-in day 18, nothing on days 19-23
  -- --------------------------------------------------------------------------
  for i in 1..30 loop
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;

    for d in 1..22 loop
      v_status := null;
      if i >= 26 then
        if d <= 18 then
          v_status := case when d % 5 = 0 then 'rest' else 'done' end;
        end if;
      elsif i <= 15 then
        v_status := case when d in (7, 14, 21) and i % 2 = 0 then 'rest' else 'done' end;
      elsif d = 22 then
        v_status := 'done';
      elsif (d + i) % 6 <> 0 then
        v_status := case
          when (d + i) % 4 = 0 then 'rest'
          when (d + i) % 7 = 0 then 'not_yet'
          else 'done'
        end;
      end if;

      if v_status is not null then
        insert into public.checkins (org_id, student_id, batch_id, day_number, status, created_at, updated_at)
        values (v_org_a_id, v_student_id, v_batch_day23_id, d, v_status,
                (v_today_a - (23 - d))::timestamptz + time '07:15',
                (v_today_a - (23 - d))::timestamptz + time '07:15');
      end if;
    end loop;

    if i <= 10 then
      insert into public.checkins (org_id, student_id, batch_id, day_number, status, created_at, updated_at)
      values (v_org_a_id, v_student_id, v_batch_day23_id, 23,
              case when i >= 9 then 'not_yet' when i % 4 = 0 then 'rest' else 'done' end,
              v_today_a::timestamptz + time '06:45', v_today_a::timestamptz + time '06:45');
    end if;
  end loop;

  -- Summer Solstice (finished): days 1-40, one missed day per student
  for i in 1..15 loop
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    for d in 1..40 loop
      if (d + i) % 11 <> 0 then
        insert into public.checkins (org_id, student_id, batch_id, day_number, status, created_at, updated_at)
        values (v_org_a_id, v_student_id, v_batch_day40_id, d,
                case when d in (7, 14, 21, 28, 35) then 'rest' else 'done' end,
                (v_today_a - (41 - d))::timestamptz + time '06:45',
                (v_today_a - (41 - d))::timestamptz + time '06:45');
      end if;
    end loop;
  end loop;

  -- New Moon (today = day 2): all answered day 1; 16-18 done today, 19 rest, 20 no answer yet
  for i in 16..20 loop
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    insert into public.checkins (org_id, student_id, batch_id, day_number, status, created_at, updated_at)
    values (v_org_a_id, v_student_id, v_batch_day2_id, 1, 'done',
            (v_today_a - 1)::timestamptz + time '07:00', (v_today_a - 1)::timestamptz + time '07:00');
    if i <= 19 then
      insert into public.checkins (org_id, student_id, batch_id, day_number, status, created_at, updated_at)
      values (v_org_a_id, v_student_id, v_batch_day2_id, 2, case when i = 19 then 'rest' else 'done' end,
              v_today_a::timestamptz + time '07:00', v_today_a::timestamptz + time '07:00');
    end if;
  end loop;

  -- Pending invites
  insert into public.batch_invites (org_id, batch_id, email, claimed_by) values
    (v_org_a_id, v_batch_day23_id, 'pending.karen@example.com', null),
    (v_org_a_id, v_batch_day23_id, 'pending.raj@example.com', null),
    (v_org_a_id, v_batch_day23_id, 'student03@example.com', 'd0000000-0000-0000-0000-000000000003'),
    (v_org_a_id, v_batch_day2_id,  'pending.mateo@example.com', null);

  -- --------------------------------------------------------------------------
  -- Org B: 5 students in Prana Sunrise (day 10), all answered every day
  -- --------------------------------------------------------------------------
  for i in 1..5 loop
    v_student_id := ('e0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;

    insert into public.profiles (id, org_id, email, full_name, role, consent_at)
    values (v_student_id, v_org_b_id, 'prana.student' || i || '@example.com',
            v_b_names[i], 'student', now() - interval '12 days');

    insert into public.enrolments (org_id, batch_id, student_id, source, joined_at)
    values (v_org_b_id, v_batch_b_id, v_student_id, 'code', (v_today_b - 10)::timestamptz);

    for d in 1..10 loop
      insert into public.checkins (org_id, student_id, batch_id, day_number, status, created_at, updated_at)
      values (v_org_b_id, v_student_id, v_batch_b_id, d,
              case when d in (4, 8) then 'rest' else 'done' end,
              (v_today_b - (10 - d))::timestamptz + time '06:30',
              (v_today_b - (10 - d))::timestamptz + time '06:30');
    end loop;
  end loop;

  -- --------------------------------------------------------------------------
  -- Lessons (placeholder content; lessons are phase 5)
  -- --------------------------------------------------------------------------
  insert into public.lessons (org_id, title, body, scope, course_id, batch_id, day_number, published, author_id) values
    (v_org_a_id, 'Welcome to daily practice', 'Placeholder lesson for all students.', 'general', null, null, null, true, v_teacher_a1_id),
    (v_org_a_id, 'Why 40 days?', 'Placeholder lesson for the 40-Day course.', 'course', v_course_a_id, null, null, true, v_teacher_a1_id),
    (v_org_a_id, 'Day 1: Setting an intention', 'Placeholder lesson for Autumn Awakening.', 'batch', null, v_batch_day23_id, 1, true, v_teacher_a1_id),
    (v_org_b_id, 'Breath foundations', 'Placeholder lesson for Prana Flow students.', 'general', null, null, null, true, v_teacher_b_id);

  -- --------------------------------------------------------------------------
  -- Learning modules and lessons (Phase 6, placeholder content)
  -- --------------------------------------------------------------------------
  insert into public.lesson_modules (id, org_id, course_id, title, description, sort_order, unlock_rule, unlock_day, published) values
    (v_mod_hp_before, v_org_a_id, v_course_a_id, 'Before you begin', 'Open as soon as you join.', 10, 'always', null, true),
    (v_mod_hp_week1,  v_org_a_id, v_course_a_id, 'Week 1 of your practice', 'Opens on day 1.', 20, 'day', 1, true),
    (v_mod_hp_week2,  v_org_a_id, v_course_a_id, 'Week 2 of your practice', 'Opens on day 8.', 30, 'day', 8, true),
    (v_mod_hp_deeper, v_org_a_id, v_course_a_id, 'Going deeper', 'Opens when you finish Week 2.', 40, 'sequential', null, true),
    (v_mod_aos_prep,  v_org_a_id, v_prog_silence_id, 'Preparing for silence', 'Open as soon as you join.', 10, 'always', null, true),
    (v_mod_aos_after, v_org_a_id, v_prog_silence_id, 'After the programme', 'Opens when you finish the preparation.', 20, 'sequential', null, true);

  insert into public.lessons (id, org_id, title, body, scope, course_id, module_id, sort_order, estimated_minutes, published, author_id) values
    ('f2000000-0000-0000-0000-000000000001', v_org_a_id, 'Welcome to the programme',
     E'## Welcome\n\nPlaceholder lesson. Your teacher replaces this text on the **Programmes** screen.\n\n- What the programme covers\n- How the daily practice works\n- Who to ask for help',
     'course', v_course_a_id, v_mod_hp_before, 10, 5, true, v_teacher_a1_id),
    ('f2000000-0000-0000-0000-000000000002', v_org_a_id, 'How the daily check-in works',
     E'Placeholder lesson.\n\n1. Open the app each day\n2. Answer **Done**, **Not yet** or **Rest day**\n3. Watch your streak grow',
     'course', v_course_a_id, v_mod_hp_before, 20, 3, true, v_teacher_a1_id),
    ('f2000000-0000-0000-0000-000000000003', v_org_a_id, 'Setting up a daily routine',
     E'Placeholder lesson about choosing a fixed time and place for practice.',
     'course', v_course_a_id, v_mod_hp_week1, 10, 5, true, v_teacher_a1_id),
    ('f2000000-0000-0000-0000-000000000004', v_org_a_id, 'Common questions in week 1',
     E'Placeholder lesson with frequently asked questions.',
     'course', v_course_a_id, v_mod_hp_week1, 20, 5, true, v_teacher_a1_id),
    ('f2000000-0000-0000-0000-000000000005', v_org_a_id, 'Staying consistent',
     E'Placeholder lesson about keeping the practice going in week 2.',
     'course', v_course_a_id, v_mod_hp_week2, 10, 5, true, v_teacher_a1_id),
    ('f2000000-0000-0000-0000-000000000006', v_org_a_id, 'Reflection: what has changed?',
     E'Placeholder reflection lesson.',
     'course', v_course_a_id, v_mod_hp_deeper, 10, 10, true, v_teacher_a1_id),
    ('f2000000-0000-0000-0000-000000000007', v_org_a_id, 'What to bring',
     E'Placeholder packing list for the silence programme.',
     'course', v_prog_silence_id, v_mod_aos_prep, 10, 3, true, v_teacher_a2_id),
    ('f2000000-0000-0000-0000-000000000008', v_org_a_id, 'Guidelines for the silence',
     E'Placeholder guidelines.',
     'course', v_prog_silence_id, v_mod_aos_prep, 20, 5, true, v_teacher_a2_id),
    ('f2000000-0000-0000-0000-000000000009', v_org_a_id, 'Carrying silence into daily life',
     E'Placeholder lesson for after the programme.',
     'course', v_prog_silence_id, v_mod_aos_after, 10, 5, true, v_teacher_a2_id);

  -- Progress: students 1-10 finished "Before you begin"; 1-5 also the first Week 1 lesson
  for i in 1..10 loop
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    insert into public.lesson_progress (org_id, student_id, lesson_id, completed_at) values
      (v_org_a_id, v_student_id, 'f2000000-0000-0000-0000-000000000001', (v_today_a - 22)::timestamptz + time '08:00'),
      (v_org_a_id, v_student_id, 'f2000000-0000-0000-0000-000000000002', (v_today_a - 22)::timestamptz + time '08:10');
    if i <= 5 then
      insert into public.lesson_progress (org_id, student_id, lesson_id, completed_at)
      values (v_org_a_id, v_student_id, 'f2000000-0000-0000-0000-000000000003', (v_today_a - 20)::timestamptz + time '08:00');
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- Follow-up plans (Phase 7, placeholder wording)
  -- --------------------------------------------------------------------------
  insert into public.followup_steps (id, org_id, course_id, kind, title, description, offset_day, sort_order, created_by) values
    (v_fu_hp_rem1,  v_org_a_id, v_course_a_id, 'reminder', 'Your 40-day practice starts today',
     'Practise at the same time each day and check in here.', 1, 10, v_teacher_a1_id),
    (v_fu_hp_call1, v_org_a_id, v_course_a_id, 'personal', 'Check-in call: how is the practice going?',
     'A short call or message to every student.', 3, 20, v_teacher_a1_id),
    (v_fu_hp_sess1, v_org_a_id, v_course_a_id, 'session', 'Week 1 follow-up session',
     'Group practice and questions.', 8, 30, v_teacher_a1_id),
    (v_fu_hp_call2, v_org_a_id, v_course_a_id, 'personal', 'Second check-in', null, 15, 40, v_teacher_a1_id),
    (v_fu_hp_rem2,  v_org_a_id, v_course_a_id, 'reminder', 'Halfway there!',
     'Twenty days of practice done. Keep going.', 21, 50, v_teacher_a1_id),
    (v_fu_hp_sess2, v_org_a_id, v_course_a_id, 'session', 'Monthly follow-up session', null, 22, 60, v_teacher_a1_id),
    (v_fu_aos_call, v_org_a_id, v_prog_silence_id, 'personal', 'How are you settling back in?', null, 4, 10, v_teacher_a2_id),
    (v_fu_aos_sess, v_org_a_id, v_prog_silence_id, 'session', 'Silence follow-up satsang', null, 10, 20, v_teacher_a2_id);

  -- Autumn Awakening (day 23): both sessions held, day-3 calls for 1-20, day-15 calls for 1-10
  insert into public.followup_records (org_id, batch_id, step_id, student_id, status, scheduled_for, location, notes, updated_by) values
    (v_org_a_id, v_batch_day23_id, v_fu_hp_sess1, null, 'done',
     (v_today_a - 15)::timestamptz + time '19:00', 'Community centre, room 2', '22 students came.', v_teacher_a1_id),
    (v_org_a_id, v_batch_day23_id, v_fu_hp_sess2, null, 'done',
     (v_today_a - 1)::timestamptz + time '19:00', 'Online (video call)', null, v_teacher_a1_id);

  for i in 1..20 loop
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    insert into public.followup_records (org_id, batch_id, step_id, student_id, status, notes, updated_by)
    values (v_org_a_id, v_batch_day23_id, v_fu_hp_call1, v_student_id, 'done',
            case when i = 2 then 'Finding mornings hard; suggested an evening slot.' end, v_teacher_a1_id);
    if i <= 10 then
      insert into public.followup_records (org_id, batch_id, step_id, student_id, status, updated_by)
      values (v_org_a_id, v_batch_day23_id, v_fu_hp_call2, v_student_id, 'done', v_teacher_a1_id);
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- Events (Phase 8). Times are local to the organisation (Asia/Dubai).
  -- --------------------------------------------------------------------------
  select timezone into v_tz from public.organisations where id = v_org_a_id;

  insert into public.events (id, org_id, kind, title, description, starts_at, ends_at, venue, online_url,
                             capacity, course_id, host_id, published, checkin_code, created_by) values
    (v_ev_talk_next, v_org_a_id, 'intro_talk', 'Introduction to the Happiness Program',
     'A free 60-minute talk about the programme, with a short guided breathing session.',
     ((v_today_a + 3)::timestamp + time '19:00') at time zone v_tz, ((v_today_a + 3)::timestamp + time '20:00') at time zone v_tz,
     'Community centre, room 2', null, 30, v_course_a_id, v_teacher_a1_id, true, 'TALKNEXT', v_teacher_a1_id),
    (v_ev_talk_past, v_org_a_id, 'intro_talk', 'Introduction to the Happiness Program',
     'A free 60-minute talk about the programme.',
     ((v_today_a - 5)::timestamp + time '19:00') at time zone v_tz, ((v_today_a - 5)::timestamp + time '20:00') at time zone v_tz,
     'Community centre, room 2', null, 20, v_course_a_id, v_teacher_a1_id, true, 'TALKPAST', v_teacher_a1_id),
    (v_ev_satsang, v_org_a_id, 'satsang', 'Monthly online satsang', 'Music, meditation and wisdom.',
     ((v_today_a + 7)::timestamp + time '18:30') at time zone v_tz, ((v_today_a + 7)::timestamp + time '20:00') at time zone v_tz,
     null, 'https://example.com/satsang', null, null, v_teacher_a2_id, true, 'SATSANG7', v_teacher_a2_id),
    (v_ev_full, v_org_a_id, 'other', 'Small-group meditation (2 places)', 'Placeholder event that is already full.',
     ((v_today_a + 10)::timestamp + time '07:00') at time zone v_tz, null,
     'Teacher''s home', null, 2, v_prog_ssm_id, v_teacher_a1_id, true, 'SMALLGRP', v_teacher_a1_id),
    (v_ev_draft, v_org_a_id, 'other', 'Draft: Yoga day', 'Not published yet.',
     ((v_today_a + 20)::timestamp + time '09:00') at time zone v_tz, null,
     'Park', null, null, v_prog_yoga_id, v_teacher_a2_id, false, 'DRAFTEVT', v_teacher_a2_id),
    (v_ev_now, v_org_a_id, 'satsang', 'Group practice (happening now)', 'Placeholder event for testing QR check-in.',
     now() - interval '30 minutes', now() + interval '60 minutes',
     'Community centre, room 1', null, null, null, v_teacher_a1_id, true, 'NOWCHECK', v_teacher_a1_id),
    (v_ev_org_b, v_org_b_id, 'satsang', 'Breath circle', 'Prana Flow community breathing.',
     ((v_today_b + 4)::timestamp + time '18:00') at time zone v_tz, null,
     'Prana studio', null, 15, null, v_teacher_b_id, true, 'BREATHB1', v_teacher_b_id);

  -- Upcoming intro talk: 6 guests (no account yet) and students 21-22
  insert into public.event_registrations (org_id, event_id, guest_name, guest_email, guest_phone, status, added_by) values
    (v_org_a_id, v_ev_talk_next, 'Guest Rania', 'guest.rania@example.com', '+971 50 000 0001', 'registered', v_teacher_a1_id),
    (v_org_a_id, v_ev_talk_next, 'Guest Omar', 'guest.omar@example.com', null, 'registered', v_teacher_a1_id),
    (v_org_a_id, v_ev_talk_next, 'Guest Priyanka', 'guest.priyanka@example.com', '+971 50 000 0003', 'registered', v_teacher_a1_id),
    (v_org_a_id, v_ev_talk_next, 'Guest Tom', null, '+971 50 000 0004', 'registered', v_teacher_a1_id),
    (v_org_a_id, v_ev_talk_next, 'Guest Lina', 'guest.lina@example.com', null, 'registered', v_teacher_a1_id),
    (v_org_a_id, v_ev_talk_next, 'Guest Sam', 'guest.sam@example.com', null, 'registered', v_teacher_a1_id);
  insert into public.event_registrations (org_id, event_id, profile_id, status, added_by) values
    (v_org_a_id, v_ev_talk_next, 'd0000000-0000-0000-0000-000000000021', 'registered', 'd0000000-0000-0000-0000-000000000021'),
    (v_org_a_id, v_ev_talk_next, 'd0000000-0000-0000-0000-000000000022', 'registered', 'd0000000-0000-0000-0000-000000000022');

  -- Past intro talk: 5 attended, 2 no-show, 1 cancelled
  insert into public.event_registrations (org_id, event_id, guest_name, guest_email, status, checked_in_at, added_by)
  select v_org_a_id, v_ev_talk_past, 'Past guest ' || g, 'past.guest' || g || '@example.com',
         case when g <= 5 then 'attended' when g <= 7 then 'no_show' else 'cancelled' end,
         case when g <= 5 then ((v_today_a - 5)::timestamp + time '18:55') at time zone v_tz end,
         v_teacher_a1_id
  from generate_series(1, 8) g;

  -- Satsang: students 1-10; full small group: students 11-12
  for i in 1..12 loop
    v_student_id := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    insert into public.event_registrations (org_id, event_id, profile_id, status, added_by)
    values (v_org_a_id, case when i <= 10 then v_ev_satsang else v_ev_full end, v_student_id, 'registered', v_student_id);
  end loop;

  -- Org B
  insert into public.event_registrations (org_id, event_id, profile_id, status, added_by)
  values (v_org_b_id, v_ev_org_b, 'e0000000-0000-0000-0000-000000000001', 'registered', v_teacher_b_id);
end;
$$;
