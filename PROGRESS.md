# Progress Tracker: Sadhana Mandala

## Done
- Saved master brief as [SPEC.md](file:///c:/Users/annak/sadhana-mandala/SPEC.md).
- Initialized [PROGRESS.md](file:///c:/Users/annak/sadhana-mandala/PROGRESS.md).
- Initialized Git repository on `main` branch connected to remote `https://github.com/annakhtoniv/sadhana-mandala.git`.
- Configured `.gitignore` to prevent secret and artifact leaks (`.env.local`, `node_modules`, `dist`, `*.zip`).
- Created [.env.example](file:///c:/Users/annak/sadhana-mandala/.env.example) and configured [.env.local](file:///c:/Users/annak/sadhana-mandala/.env.local) with live Supabase credentials (`https://pshapxojprvgmwhdivim.supabase.co`).
- Verified Phase 0 Google sign-in and sign-out live flow.
- Added SPA routing rewrite configurations (`.htaccess` for Spaceship/Apache and `_redirects` for static hosts).
- Configured automated GitHub Actions deployment pipeline ([.github/workflows/deploy.yml](file:///c:/Users/annak/sadhana-mandala/.github/workflows/deploy.yml)) and GitHub Pages workflow ([.github/workflows/pages.yml](file:///c:/Users/annak/sadhana-mandala/.github/workflows/pages.yml)).
- Completed Phase 1: White-label theming, mandatory consent modal storing `consent_at`, role routing, profile screen with account deletion, and resolved re-render loop.
- Completed Phase 2:
  - Drafted [supabase/schema_phase2.sql](file:///c:/Users/annak/sadhana-mandala/supabase/schema_phase2.sql) with tables `courses`, `batches`, `batch_invites`, `enrolments`, RLS policies, and RPC functions (`claim_pending_invites`, `join_batch_by_code`, `add_batch_invites`).
  - Added timezone-aware date utilities in [src/lib/dateUtils.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/dateUtils.ts) calculating batch day numbers from `start_date` in the organisation timezone.
  - Built [src/lib/batchService.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/batchService.ts) for courses, batches, invites, enrolments, and auto-mapping.
  - Updated [src/context/AuthContext.tsx](file:///c:/Users/annak/sadhana-mandala/src/context/AuthContext.tsx) to automatically claim pending invites on sign-in and manage enrolment state.
  - Enhanced [src/components/StudentHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/StudentHome.tsx) with un-enrolled join code panel and active enrolled view (day number, question, and dynamic `duration_days` practice trail).
  - Built [src/components/TeacherBatchDetail.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/TeacherBatchDetail.tsx) with join code display, live QR code (`qrcode.react`), email pasting with auto-mapping, and student roster.
  - Enhanced [src/components/TeacherHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/TeacherHome.tsx) with "My Batches" dashboard and batch creation modal.
  - Enhanced [src/components/AdminHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/AdminHome.tsx) with Course Catalog management and All Batches overview.
  - Fixed consent prompt repetition across page reloads by pairing database sync with local persistent storage.
  - Created [supabase/seed_dummy_data.sql](file:///c:/Users/annak/sadhana-mandala/supabase/seed_dummy_data.sql) seeding complete dummy data for everything:
    - Organisation A ("Sadhana Mandala", dark stone + emerald theme, Dubai timezone, Powered by ZYXENAI)
    - Organisation B ("Prana Flow Academy", slate + amber theme, Dubai timezone, show_powered_by false)
    - Courses (40-Day Sadhana, 21-Day Mindfulness Starter, Prana Foundation 30)
    - Teachers & Admins (Ananda Sharma, Priya Patel, Sadhana Admin, Marcus Vance, Prana Admin)
    - Batches in Org A: Day 40 Finished ("Summer Solstice"), Day 23 Active ("Autumn Awakening"), Day 2 Fresh ("New Moon"), Day 1 ("October Sadhana")
    - Batches in Org B: Day 10 Active ("Prana Sunrise")
    - 30 clearly fictional students in Org A and 5 students in Org B with full profiles and consent
    - Complete check-ins with streaks, rest days, and 5 demonstrable QUIET students (Days 19-23 silent)
    - Real published meditation and daily wisdom lessons (General, Course, and Batch daily scope)
  - Created [src/components/LessonsScreen.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/LessonsScreen.tsx) and updated [src/types/database.ts](file:///c:/Users/annak/sadhana-mandala/src/types/database.ts) to display published lessons.
  - Created [HANDOVER.md](file:///c:/Users/annak/sadhana-mandala/HANDOVER.md) with complete office laptop transition and project handover instructions.
- Completed Phase 3 & Usability Enhancements:
  - Drafted [supabase/schema_phase3.sql](file:///c:/Users/annak/sadhana-mandala/supabase/schema_phase3.sql) containing `checkins` table definition (`student_id`, `batch_id`, `day_number`, `status`, `updated_at`), indexes, automatic `updated_at` trigger, and RLS policies for students, teachers, and admins.
  - Built pure utility module [src/lib/practiceUtils.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/practiceUtils.ts) exporting:
    - Timezone-aware day number calculation (`Asia/Dubai` default, start_date = Day 1).
    - Consecutive streak calculation (consecutive 'done' days, 'rest' preserving streak without adding, 'not_yet' breaking streak, gap days breaking streak, today in-progress preserving prior streak).
    - Quiet student detection logic (no check-in of any kind for 4 consecutive days up to current day).
    - Practice trail status mapping (`done`, `rest`, `not_yet`, `missed`, `today`, `future`).
    - In-memory idempotent upsert (`upsertCheckinInMemory`) guaranteeing single row per (student, batch, day).
  - Built Supabase persistence service [src/lib/checkinService.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/checkinService.ts) supporting idempotent upsert targeting `unique(student_id, batch_id, day_number)` and seamless fallback demo data.
  - Enhanced [src/components/StudentHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/StudentHome.tsx) with:
    - Daily check-in options ('done', 'not_yet', 'rest') saving to and loading from Supabase `checkins` table.
    - Idempotent updates (tapping twice or changing answer updates today's row, never duplicates it).
    - Live streak calculation with flame icon badge.
    - Dynamic 7-column practice trail rendering for `duration_days` visually representing 'done', 'rest', 'not_yet', and 'missed' statuses with locked/greyed out future days.
    - Past date marking and viewing.
    - 1-Click Demo Cohort Join buttons (`AUTUMN23`, `SADH40`) on the un-enrolled screen.
  - Enhanced [src/components/TeacherBatchDetail.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/TeacherBatchDetail.tsx) with today's metrics summary (Done, Rest, Not yet, Quiet) and sortable student roster (by Quiet, Streak, Status, Name) with Quiet student warnings.
  - Built [src/components/GuidedTour.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/GuidedTour.tsx) interactive tour with mathematical coordinate clamping, directional arrows, and real-time Navigation Fluency Gauge.
  - Added 1-Click Demo Login (`Vinoth Rajaasekaran`) in [src/App.tsx](file:///c:/Users/annak/sadhana-mandala/src/App.tsx) for instant preview in embedded IDE webviews.
  - Created [RUN_THIS_IN_SUPABASE.sql](file:///c:/Users/annak/sadhana-mandala/RUN_THIS_IN_SUPABASE.sql) all-in-one SQL setup script.
  - Fixed cohort batch creation end-to-end:
    - Added dedicated "+ New Cohort Batch" modal in [src/components/AdminHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/AdminHome.tsx) allowing admins to launch batches with course, teacher, start date, and custom join code.
    - Fixed silent form validation failures in [src/components/TeacherHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/TeacherHome.tsx) with clear error feedback and instant optimistic state updates.
    - Updated [src/lib/batchService.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/batchService.ts) to verify and resolve valid foreign keys against `courses` and `profiles` before Supabase insertion, preventing foreign key constraint errors (`batches_course_id_fkey`, `batches_teacher_id_fkey`).
    - Unified [src/lib/batchService.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/batchService.ts) `fetchTeacherBatches` to merge local/custom cohorts with Supabase records, ensuring created cohorts appear immediately even offline or prior to DB indexing.
  - Redesigned Admin Panel in the signature Human 2.0 Sleep App aesthetic:
    - Replaced generic layout with the obsidian dark & warm daylight palette (`#070b0e`, `#0e161b`, `#121e25`, `#1d2e38`, `#f7f3ec`, `#e6dccb`), signature gold/sunrise accents (`#e8b98a`, `#d9a44a`), and deep petroleum teal (`#17495e`).
    - Added pulsing emerald live beacon (`#4ba377`) and Sovereign Admin gradient status pill.
    - Implemented Tonight's Bedtime Immersion styled Executive Operations Hero Card with instant action tiles.
    - Added Sanctuary KPI Metric Grid (Students, Active Cohorts, Curricula Programs, Quiet Alerts).
    - Added Human 2.0 Segmented Tab Navigation pills (Cohorts, Users & Roles, Curricula, System Parameters).
    - Designed interactive Cohort Cards with day progress bars, 1-click join code copy, and full-screen QR code onboarding modal powered by `QRCodeSVG`.
    - Added fast profile role selector for instant upgrades/downgrades.
  - Verified 100% automated test coverage with 54 unit tests passing across all test suites via `npm.cmd test`.
  - Verified clean TypeScript compilation and production build via `npm.cmd run build`.
  - Updated `sadhana-mandala-build.zip` archive for immediate Spaceship deployment.
  - Locked Admin Identity & Infallible Batch Creation:
    - Locked `annakhtoniv@gmail.com` as Sovereign Admin (`Vinoth Rajaasekaran`) in `mockData.ts`, `AuthContext.tsx`, and `AdminHome.tsx`.
    - Fixed cohort batch creation across both Teacher and Admin dashboards with guaranteed fallback curricula (`40-Day Sadhana Practice`, `21-Day Mindfulness Starter`) and pre-selected Presiding Teacher (`Vinoth Rajaasekaran`).
    - Added Console Quick Switch buttons to `ProfileScreen.tsx` for 1-tap switching between Admin Console and Teacher Dashboard.
    - Synchronized dependency provisioning in `batchService.ts` to ensure batches are saved locally and synced to Supabase without blocking UI.

- Phase 4 review (2026-10-11) found that the teacher dashboard had never shown real database data, and that data isolation did not hold. Fixed in code and in the live database.
  - Live database: every signed-in query on batches, enrolments, profiles, lessons and check-ins failed with "infinite recursion detected in policy". The app hid this by showing mock data (`mockData.ts`), so the dashboard looked like it matched the seed.
  - Live database: any signed-in user could make themselves admin (`set_my_role`, or by editing their own profile) or move into another organisation by changing `profiles.org_id`. Inside an organisation, any student could read and change every check-in, batch, invite and role grant. Join codes worked across organisations.
  - Added [supabase/phase4_security.sql](supabase/phase4_security.sql): replaces every policy with one non-recursive set following the SPEC access rules, adds the profile protection trigger (no self role/org change), removes `set_my_role`, makes join codes organisation-only, enforces "check in for today only", makes "Delete my account" remove the profile, check-ins and enrolments, and blocks anonymous visitors from all functions.
  - Rewrote [supabase/seed_dummy_data.sql](supabase/seed_dummy_data.sql) to match the SPEC exactly and be re-runnable: Org A 1 course, 3 batches (finished, day 23, day 2), 30 students, 5 quiet; Org B 1 batch, 5 students, show_powered_by false. It resets earlier dummy data first and never touches real accounts or policies.
  - Added `supabase/phase4_verify.sql` (now `supabase/verify.sql`): 24 checks that sign in as the fictional teachers, student and admin and confirm the dashboard numbers and that nothing crosses organisations. Nothing is saved. Tested on a local copy of the live setup: 12 checks fail before the fix, 24/24 pass after.
  - App: sample data now appears only after pressing the 1-click demo button. A real Google session always shows what the database returns, or an error message. Removed the silent auto-login as the demo admin on first visit, the "email contains annakhtoniv/vinoth = admin" rule, and the role switcher's database write (it is now a view switcher limited to your own role and below). Students with no batch now see the "not in a batch yet" panel instead of a fake batch. Scanning a batch QR code now joins that batch after sign-in (the `?code=` link was never read before).
  - Teacher dashboard: added the "No answer" count, fixed finished batches flagging every student as Quiet, fixed sort by today's status, shows last check-in day and date, shows load errors.
  - 59 unit tests passing (`npx vitest run`), clean build (`npm run build`).

- Removed the old Spaceship deployment (`.github/workflows/deploy.yml`, `scripts/deploy-ftp.*` and the `basic-ftp` package). It failed on every push to main after hosting moved; GitHub Pages (`.github/workflows/pages.yml`) is the only deployment now.

- Phase 4 database steps completed on 2026-10-12: `phase4_security.sql`, `seed_dummy_data.sql` and the leftover-profile cleanup were run in the Supabase SQL editor; `phase4_verify.sql` returned 24/24 PASS. The two other real Google accounts were set from admin to student; annakhtoniv@gmail.com is the only real admin.
- **Phase 4 signed off on 2026-10-12 (DEMO CUT LINE reached).** Tested on a phone at sadhana.zyxenai.com, signed in with Google, Teacher view, "Autumn Awakening Cohort": Done 6, Rest 2, Not yet 2, No answer 20, Quiet 5, 30 students, 3 invites. Matches the seed exactly.

- Scope extended on 2026-10-12 to a "Sadhana ERP" (programmes, LMS, follow-ups, events, CRM for volunteers); see SPEC.md "Sadhana ERP" and phases 5-10. PM decisions: follow-ups are a mix that differs per programme; admins and teachers both add programmes; volunteers invite leads all three ways (manual, one-tap links, automatic later); dummy data until the first real group; this is a pilot for AOL, so every programme is configuration.
- Phase 5 (programme catalogue and multi-enrolment) built and deployed on 2026-10-12 (SQL run in Supabase, 29/29 PASS; PR merged):
  - [supabase/phase5_programmes.sql](supabase/phase5_programmes.sql): the `courses` table becomes the programme catalogue (code, category, programme length, prerequisites, active flag, display order, optional daily practice track). Teachers can now add and edit programmes as well as admins. Daily check-ins are only accepted for programmes with a practice track. Only adds things; safe to re-run.
  - [supabase/seed_dummy_data.sql](supabase/seed_dummy_data.sql): the course is now the Happiness Program with its 40-Day Sadhana track; added the starting AOL catalogue (Art of Silence, Sahaj Samadhi Meditation, Sri Sri Yoga, Volunteer Training Program, Advanced Meditation Program) and two batches, "Art of Silence – September" (finished, students 1-10) and "VTP – October" (running, students 1-5), both taught by Priya Patel. Phase 4 numbers are unchanged.
  - [supabase/verify.sql](supabase/verify.sql) (renamed from `phase4_verify.sql`): 29 checks, adding that a teacher can add a programme but not in another organisation, a student cannot add one, a student sees all four of their programmes, and a check-in on VTP (no practice track) is refused. Tested on a local copy: 29/29 PASS, and the seed is safe to run twice.
  - App: new Programmes screen for admins (Admin > Programmes tab) and teachers (Teacher home > Programmes). Students in more than one programme see "My programmes" and can switch; only programmes with a practice track show the daily check-in, streak and trail. Students can join another programme with its join code. Batches of programmes without a practice track show the roster without check-in counts.
  - 81 unit tests passing (22 new for programme rules), clean build.

- Phase 6 (LMS) built on 2026-10-12, waiting for the PM to run the SQL and test:
  - [supabase/phase6_lms.sql](supabase/phase6_lms.sql): new tables `lesson_modules` (per programme, with an unlock rule: open from the start, on day N of the student's batch, or after the previous module) and `lesson_progress` (completed lessons per student); lessons gain `module_id`, display order and minutes. The database hides lessons of locked modules from students and only lets them complete lessons they can open. Admins and teachers manage modules and lessons. Only adds things; safe to re-run.
  - Seed: placeholder modules for the Happiness Program (Before you begin; Week 1, opens day 1; Week 2, opens day 8; Going deeper, after Week 2) and Art of Silence (Preparing for silence; After the programme), and lesson progress for students 1-10.
  - [supabase/verify.sql](supabase/verify.sql): 37 checks (8 new): teacher adds a module and lesson; teacher sees own students' progress; student sees only their programmes' modules, cannot open locked lessons or complete them, and finishing Week 2 opens "Going deeper"; student cannot add a module. 37/37 PASS on a local copy; a check fails if the lock rule is removed.
  - App: Programmes screen > "Learning modules" on each programme: add, edit, hide, reorder and delete modules and lessons (text with simple formatting and preview, optional https video link, minutes). Students see a "Learning" section for the selected programme with progress, locked modules and why they are locked, a lesson reader and "Mark as complete". Teachers see "Lessons: x of y" per student in the batch roster. The Lessons tab now shows only lessons outside programme modules.
  - Lesson text uses a small built-in formatter (headings, bold, italic, lists, https links) that never runs HTML from the text.
  - 97 unit tests passing (16 new for module unlocking, progress, validation and the formatter), clean build.

## Next
- PM: in the Supabase SQL editor run, in this order: `supabase/phase6_lms.sql`, `supabase/seed_dummy_data.sql`, `supabase/verify.sql` (all 37 rows PASS). Then merge the Phase 6 pull request.
- PM: test Phase 6 (sign in with Google):
  1. Teacher view > Programmes > Happiness Program > Learning modules: four modules are listed. Add a lesson to "Before you begin" (use Preview), and add a new module that opens on day 30.
  2. Open the Autumn Awakening roster: students 1-10 show "Lessons: 2 of 6" or "3 of 6", the others "0 of 6".
  3. Student side (demo button, View: Student): the Learning section shows the modules, "Going deeper" is locked with its reason, and "Mark as complete" updates the progress bar.
- Then Phase 7 (follow-ups per programme).
- Before a demo on any later day, re-run `supabase/seed_dummy_data.sql` that morning, so the batches sit on day 23 / day 2 / finished again.
- To check the dashboard against the seed, sign out first and sign in with Google. The 1-click demo button shows sample data from `mockData.ts`, not the database.

## Before working with a real batch
Decided 2026-10-12: keep the demo data and the 1-click demo login until after the teacher's feedback. Then, before the first real batch:
- Clean the database: remove all fictional `@example.com` profiles, the seeded batches, enrolments, check-ins, invites and placeholder lessons in both organisations. Keep real accounts. Decide whether Organisation B (Prana Flow) stays.
- Decide about the 1-click demo login: remove it, or keep it with a visible "Demo – sample data" banner.
- Clear demo logins saved in browsers from before 2026-10-11 (the old automatic demo login). Until then, anyone who visited the site earlier sees sample data until they sign out once.

## Known Issues
- Anyone who visited before 2026-10-11 still has the old automatic demo login saved in their browser and sees sample data until they sign out (see "Before working with a real batch").
- Demo mode is not labelled on screen, so sample data can be mistaken for real data.
- Admin screens (`AdminHome.tsx`, phase 6) still mix in sample data and a hardcoded admin name; left for phase 6.
- `RUN_THIS_IN_SUPABASE.sql` still contains the old unsafe policies; never run it without `supabase/phase4_security.sql` after it.
