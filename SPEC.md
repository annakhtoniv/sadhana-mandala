# MASTER BRIEF: Sadhana Mandala, a white-label daily practice companion

You are building a mobile-first web app. Read this whole brief before doing
anything. I am a project manager, not a developer. Explain every manual step
(Supabase dashboard, Google Cloud, my web hosting, GitHub) click by click, and
never assume I know a term.

## How to work
- Build the phases below in order. After each phase: stop, tell me how to test
  it, update PROGRESS.md, commit, and wait for my go-ahead.
- First action: save this brief as SPEC.md and create PROGRESS.md (done, next,
  known issues). Update PROGRESS.md before every commit. I switch machines, so
  these two files are your memory.
- Do not add features that are not in this brief. Ask if something is unclear.
- Secrets live in .env.local, never in Git. Provide .env.example.
- The Supabase service role key is used only in local scripts or server-side
  functions, never in the browser.
- Dummy data only. No real people.
- Project folder and repository name: sadhana-mandala.

- Remote repository: https://github.com/annakhtoniv/sadhana-mandala.git
  Connect this folder to it and push after every commit.

## Product
After a short meditation course, students commit to a daily practice for 40
days. Students check in each day. Teachers see who is practising and who has
gone quiet. Lessons support the practice.

This is a white-label platform owned by ZYXENAI. The footer shows
"Powered by ZYXENAI" when the organisation's show_powered_by is true. Apart
from that line, no brand name, logo, colour or wording is hardcoded: all of it
comes from the organisation record. Show a small "Concept" label in the footer.

## Stack
React + Vite + TypeScript + Tailwind. Supabase for database, Google sign-in
and row level security. Installable PWA (manifest, icons, vite-plugin-pwa).
No separate backend server.

Hosting: my existing web hosting for zyxenai.com, served at
sadhana.zyxenai.com. Do not use Vercel or any new hosting service. In phase 0,
ask me which hosting provider I use, then walk me through creating the
subdomain, enabling HTTPS, uploading the build, and the rewrite rule that
sends every path to index.html. Give me a repeatable publish step I can run
after each phase.

## Roles
student (default for every new sign-in), teacher, admin.
A table role_grants sets a role by email at first sign-in. A user can never
change their own role or organisation.

## Data model (every table except organisations carries org_id)
- organisations: id, name, slug, app_name, logo_url, primary_colour,
  accent_colour, support_email, checkin_question, footer_text, timezone
  (default Asia/Dubai), show_powered_by (default true)
- profiles: id (= auth user), org_id, email, full_name, role, consent_at
- role_grants: org_id, email, role
- courses: name, description, duration_days (default 40)
- batches: course_id, teacher_id, name, start_date, join_code (unique)
- batch_invites: batch_id, email (lowercase), claimed_by;
  unique(batch_id, email)
- enrolments: batch_id, student_id, source (invite | code | manual),
  joined_at; unique(batch_id, student_id)
- checkins: student_id, batch_id, day_number, status (done | not_yet | rest),
  updated_at; unique(student_id, batch_id, day_number)
- lessons: title, body (markdown), video_url (optional), scope
  (general | course | batch), course_id, batch_id, day_number (optional),
  published, author_id

## Access rules (enforce with row level security, not only in the UI)
- Every rule also requires a matching org_id. No data crosses organisations.
- Student: reads and writes only own check-ins; reads own enrolments; reads
  published lessons that are general, or belong to a course or batch they are
  enrolled in.
- Teacher: full control of own batches, their invites and batch lessons; reads
  enrolments, profiles and check-ins of students in own batches only.
- Admin: everything inside their own organisation.
- Use security definer helper functions for the current user's org and role,
  so policies do not become recursive.

## Business rules
- Organisation: v1 resolves it from the env variable VITE_ORG_SLUG and sets it
  once at first sign-in. Structure the code so it can later come from the
  subdomain.
- Mapping: the teacher pastes student emails into a batch. A matching email is
  enrolled automatically. Check for unclaimed invites on every sign-in, not
  only the first. Fallback: the student enters the batch join code or scans
  its QR. A join code works only inside its own organisation.
- A user with no batch can still sign in. They see general lessons and a
  "You are not in a batch yet" panel with a join code field. Nothing else.
- Day number comes from the batch start_date in the organisation timezone.
  Day 1 is the start date. A student can check in for today only and can
  change today's answer. A second tap updates the row, never duplicates it.
- Nothing in the code assumes a fixed programme length. Use duration_days.
- Streak: consecutive "done" days. A rest day neither adds to nor breaks the
  streak. A passed day with "not_yet" or no answer breaks it.
- Quiet: no check-in of any kind for 4 consecutive days.
- Consent: at first sign-in the user accepts a screen stating what is stored
  (name, email, daily answers, times) and that the teacher sees it. Store
  consent_at.
- Delete my account: removes the sign-in account, profile, enrolments and
  check-ins for real. Confirm before deleting.

## Screens
Student: Home (today's question from checkin_question with Done / Not yet /
Rest day, streak, a trail of all days in rows of seven), Lessons (My batch,
General), Profile (consent date, leave batch, delete account).
Teacher: My batches; Batch detail (counts for today, roster with today's
status, streak, last check-in and a Quiet flag, sortable; add emails; join
code and QR; batch lessons).
Admin: Users and roles; Courses; All batches; General lessons.

## Design
Design for a 400px phone screen first, then desktop. Calm and uncluttered,
large tap targets, light and dark themes, readable contrast. Colours and logo
come from the organisation record.

## Phases
0. Setup: Git repo, Supabase project, Google sign-in, an empty page running
   on my computer, then published to sadhana.zyxenai.com. Show me how to add
   test users to Google sign-in so invited people can sign in during a demo.
   Test: the page opens at sadhana.zyxenai.com on my phone over HTTPS.
1. Organisations, sign-in, profiles, role_grants, consent, routing by role.
   Test: I sign in with Google and land on the right home for my role.
2. Courses, batches, invites, auto-mapping, join code and QR. Test: an invited
   email is enrolled on sign-in; an uninvited one sees the no-batch panel.
3. Student check-in, streak and trail, with unit tests for day number, streak
   and quiet logic. Test: tapping twice leaves one row.
4. Teacher batch dashboard, plus a seed script. Organisation A, app_name
   "Sadhana Mandala": 1 course, 3 batches (finished at day 40, day 23, day 2),
   30 clearly fictional students with example.com emails and varied check-ins,
   including 5 quiet students. Organisation B: different name and colours,
   show_powered_by false, 1 batch, 5 students. Test: the dashboard matches the
   seed, and a teacher in A cannot read anything from B.
   --- DEMO CUT LINE --- (Phases 0-4 done; Phase 4 signed off 2026-10-12)

## Sadhana ERP (scope extension agreed 2026-10-12)
The app grows from a 40-day practice companion into a small ERP for the
whole student journey, piloted for The Art of Living (AOL). It keeps the
white-label rule: every programme name, practice, module and follow-up is
configuration data, never code. We copy proven data designs from Odoo (CRM
pipeline, Events, eLearning) but do not run Odoo itself: it needs its own
server and per-user licences, and would lose this mobile-first app.

### Programmes (catalogue, configurable)
- The `courses` table is the programme catalogue. In the app it is called
  "Programmes". Admins and teachers can add and edit programmes on screen.
- A programme has: name, code, category, description, programme length in
  days (optional), prerequisite programmes, active flag, display order, and
  an optional daily practice track (name and number of days).
- The daily practice track is per programme. For AOL only the Happiness
  Program has one (the 40-day Sadhana). Programmes without a track have no
  daily check-in.
- A batch is one run of a programme (dates, teacher, join code and QR).
- A student can be enrolled in many programmes over time, e.g. Happiness
  Program, then Art of Silence, then VTP. The student home shows "My
  programmes" and each one keeps its own history.
- Starting AOL catalogue (data, editable): Happiness Program, Art of
  Silence, Sahaj Samadhi Meditation, Sri Sri Yoga, Volunteer Training
  Program (VTP), Advanced Meditation Program, plus any added later.

### Follow-ups (per programme)
A mix, different per programme: follow-up sessions (events), personal
follow-up by a teacher or volunteer (a task with notes), and practice
reminders. Each programme defines its own follow-up plan.

### LMS (per programme)
Each programme has its own learning modules made of lessons (text, video
link), unlocked by day or by finishing the previous one, with progress per
student.

### Events
Intro talks, programme runs, satsangs and follow-up sessions: schedule,
venue or online link, capacity, registration and attendance (QR check-in).

### CRM (for volunteers)
- New role: volunteer (in addition to student, teacher, admin).
- Contacts (people without an account yet), leads with a pipeline: New,
  Invited to intro talk, Attended, Interested, Registered for Happiness
  Program, Completed. Notes and calls, owner volunteer, source.
- Converting a lead registers them for an event or a programme; when they
  sign up, the contact links to their account.
- Inviting leads, all three ways: (a) the app shows the contact details and
  the volunteer sends the message themselves, (b) one-tap WhatsApp and email
  links, (c) automatic sending, which needs a paid email or WhatsApp
  provider and comes last.

### Data
Dummy data only until the first real group. Before real people's data is
added (especially CRM contacts who have not signed up), add a consent and
opt-out approach that follows the UAE data protection law (PDPL), approved
by the organisation.

## Phases (continued)
5. Programme catalogue and multi-enrolment: programmes screen for admins
   and teachers, AOL catalogue in the seed, practice track per programme,
   "My programmes" for students. Test: a teacher adds a programme without
   code changes; a student in three programmes sees all three; only the
   Happiness Program has the 40-day check-in.
6. LMS: modules and lessons per programme, progress per student
   (replaces the old "Lessons" phase). Test: a teacher adds a module and a
   lesson without code changes; a student sees a locked module open on its
   day or after finishing the previous one; the teacher sees each
   student's lesson progress.
7. Follow-ups per programme: a plan of steps per programme (follow-up
   sessions, personal follow-ups, practice reminders), each due on a day of
   the batch. Test: a teacher adds a step without code changes; the batch
   screen shows what is due; the teacher schedules and holds a session and
   ticks students off with notes students never see; students see the
   reminder and the session time in the app.
8. Events: intro talks, registrations, attendance. Test: a teacher creates
   an intro talk with a capacity; a member registers and cancels; staff add
   guests without an account; a full event refuses more registrations;
   scanning the event's check-in QR at the event marks the member attended;
   members never see other attendees or the check-in code.
9. CRM for volunteers: contacts, pipeline, conversion to event or
   programme registration, invites (manual and one-tap links).
10. Admin screens, funnel reports (leads, intro talk, Happiness Program,
    Sadhana completed, next programme), automatic invites, PWA install and
    final polish (replaces the old phases 6 and 7).

## Out of scope (do not build)
Community or chat, payments, native mobile apps, organisation self-signup,
billing, per-organisation domains, accounting, inventory, HR, a platform
owner screen (I manage organisations in the Supabase table editor).
Notifications and integrations only as described for CRM invites and
practice reminders above.

https://github.com/annakhtoniv/sadhana-mandala.git
