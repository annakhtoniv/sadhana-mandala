-- ============================================================================
-- Sadhana Mandala: Phase 4 dummy data seed (SPEC.md phase 4)
--
-- Organisation A "Sadhana Mandala": 1 course, 3 batches (finished at day 40,
--   day 23, day 2), 30 clearly fictional students with example.com emails and
--   varied check-ins, including 5 quiet students.
-- Organisation B "Prana Flow Academy": different name and colours,
--   show_powered_by false, 1 batch, 5 students.
--
-- Re-runnable: every run first removes earlier dummy data (all @example.com
-- profiles in these two organisations and the seeded batches), then recreates
-- it with dates relative to TODAY in the organisation timezone. Run it again
-- on the morning of a demo so the batches sit on day 23 / day 2 / finished.
--
-- Real accounts are never deleted or changed by this script.
-- Run supabase/phase4_security.sql first, and supabase/phase4_verify.sql after.
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
  where id in (v_batch_day23_id, v_batch_day40_id, v_batch_day2_id, v_batch_old_day1, v_batch_b_id);

  -- Batches a dummy teacher still owns (from older seed versions)
  delete from public.batches b
  using public.profiles p
  where p.id = b.teacher_id and p.org_id in (v_org_a_id, v_org_b_id) and p.email like '%example.com';

  delete from public.batch_invites where org_id in (v_org_a_id, v_org_b_id) and email like '%example.com';
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
  -- Courses (1 per organisation)
  -- --------------------------------------------------------------------------
  insert into public.courses (id, org_id, name, description, duration_days)
  values (v_course_a_id, v_org_a_id, '40-Day Sadhana Practice',
          'A daily meditation and awareness commitment for forty days.', 40)
  on conflict (id) do update set org_id = excluded.org_id, name = excluded.name, duration_days = 40;

  insert into public.courses (id, org_id, name, description, duration_days)
  values (v_course_b_id, v_org_b_id, 'Prana Foundation 30',
          'Pranayama breathwork over 30 days.', 30)
  on conflict (id) do update set org_id = excluded.org_id, name = excluded.name, duration_days = 30;

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
    (v_batch_b_id,     v_org_b_id, v_course_b_id, v_teacher_b_id,  'Prana Sunrise Cohort',     v_today_b - 9,  'PRANA10');

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
end;
$$;
