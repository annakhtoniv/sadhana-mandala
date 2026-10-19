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
- checkins: student_id, batch_id, day_number, morning, evening (ticks),
  morning_at, evening_at, late (written after its day), status (kept in step:
  done when a tick is set; 'rest' only on old rows), updated_at;
  unique(student_id, batch_id, day_number)
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
  Day 1 is the start date. Each day has two ticks, Morning and Evening (no
  rest days; PM decision 2026-10-18). A student can tick today or any past
  day of the batch, never a future day; a tick written after its day is
  marked late and teachers see it. Tapping again changes the tick and updates
  the one row of that day, never duplicates it.
- Nothing in the code assumes a fixed programme length. Use duration_days.
- A day counts (streak, trail, reports) when at least one tick is set.
- Streak (the practice flame): consecutive days that count, ending today, or
  yesterday while today has no tick yet. A passed day without a tick breaks
  it; filling the day in later repairs it.
- Quiet: no tick for 4 consecutive days.
- Consent: at first sign-in the user accepts a screen stating what is stored
  (name, email, daily answers, times) and that the teacher sees it. Store
  consent_at.
- Delete my account: removes the sign-in account, profile, enrolments and
  check-ins for real. Confirm before deleting.

## Screens
Student: Home (today's question from checkin_question with Morning and
Evening ticks, the practice flame, a trail of all days in rows of seven where
both ticks show a full circle, one tick a half circle, and tapping a past day
opens it for check-in), Lessons (My batch,
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
- Places are said one way everywhere: "22 of 30 places left", "Full: all 30
  places taken", or "10 registered · no limit". A full event says so where
  the Register button would be.
- A person's own status reads as their own ("You cancelled your place",
  "You attended"); after cancelling they can "Register again".
- Times name the organisation's city and offset ("Dubai time (GMT+4)").
- The result of Register or Cancel appears on that event's card: green for
  success, red for a problem. Buttons say which event they are for (screen
  readers).

### Batch dates
- Every batch has a first and a last day. The last day defaults to the
  programme's length (daily practice, else the programme itself) and can be
  changed in the batch editor; it is never before the first day.

### Practice screen colours
- Morning done: soft yellow (#FFF0C2) with dark text (#6B4A00); Evening done:
  soft purple (#E9E7FF) with dark text (#302777). Each done tile also has a
  coloured edge, a filled tick and the word "Done".
- The week strip shows that week's count; the overall "So far: x of y days
  practised" sits under the flame.

### Profile
- Privacy shows what is kept, who sees it, that it is kept until the account
  is deleted, and that deleting the account withdraws consent. The consent
  time names the organisation's time zone.
- Reminders card: "not switched on yet" while the organisation has not set
  reminders up; "this browser cannot" only for browsers without push.

### Staying signed in
- Signing in once keeps a person signed in on that device until they sign
  out. Signing out on one device never signs out the others.
- On iPhone, Google sign-in from the Home Screen app opens in a Safari window;
  the sign-in is handed over to the app (one-time code, picked up once, gone
  after 10 minutes), so the app itself is signed in.

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

- Volunteers see and manage only the leads they own; admins and teachers see
  all leads, assign owners and see the reports. Each lead records whether
  the person agreed to be contacted and whether they opted out; the app shows
  no message buttons for people who opted out.
- The stage moves forward by itself: attending an event -> Attended,
  enrolling in a batch -> Registered. A lead who signs up with the same email
  is linked to their account.

### Batch QR join
A batch QR code (or its link) opens the app with ?code=JOINCODE. A person
with no account and no link beforehand scans it, sees which batch they are
joining on the sign-in page, signs in with Google and is enrolled
automatically. The code is kept on the device across the Google sign-in for
up to a day. Teachers and admins can share the link (share sheet, WhatsApp,
copy) or download a printable QR poster.

### Reports (Phase 10)
Funnel for admins and teachers: leads -> invited to an intro talk ->
attended -> interested -> registered -> completed (each lead counted at the
furthest stage it reached), and per programme with a practice track:
enrolled -> practice period over -> completed the practice ("done" on at
least 80% of its days) -> went on to a next programme. Per source and per
volunteer. All time or the last 90 or 30 days.

### Roles (Phase 13)
A person can hold several roles at once (Student, Volunteer, Teacher, Admin;
at least one). They get everything their highest role allows. Only an admin
changes roles; an admin cannot remove their own Admin role. Roles can be
given to an email before the person first signs in.

### Data safety (Phase 14)
Practice history is never deleted as a side effect: only admins delete
programmes; a programme with batches, a batch with check-ins and a teacher
with batches cannot be deleted. The organisation always keeps at least one
admin. Teachers see only their own leads and the guests of events they host.
Volunteers cannot enrol existing members; they send them the batch link.
Join codes are random (8 characters) and wrong codes are limited to 10 per
15 minutes. Consent is recorded in the database with the version of the text.

### Profile pictures (Phase 12)
Everyone's Google photo is used automatically and refreshed at each sign-in.
Anyone can upload their own picture instead (Profile, camera button) and go
back to the Google photo. Only a Google photo or a picture in the app's own
storage is accepted.

### Study materials (Phase 12)
Per programme, staff upload PDFs, audio, video, pictures and documents (up to
50 MB each) or add links, and can rename, reorder, hide and delete them. Every
batch of the programme, current and future, sees the published materials.
Files are private: only staff of the organisation and students enrolled in
the programme can open them.

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
   programme registration, invites (manual and one-tap links), and the
   batch QR join for new students. Test: a volunteer sees only their own
   leads; inviting a lead to an intro talk puts them on its guest list and
   marking them attended moves the lead; registering a lead for a batch
   enrols them when they sign in; scanning a batch QR, signing in with
   Google enrols a brand-new student.
10. Admin screens, funnel reports (leads, intro talk, Happiness Program,
    Sadhana completed, next programme), automatic invites, PWA install and
    final polish (replaces the old phases 6 and 7).
11. Morning and Evening check-ins, past days, redesign.
12. Profile pictures (Google photo or upload) and study materials per
    programme. Test: a student sees the published materials of their
    programme and not others; a student cannot add materials; a teacher
    cannot upload into another organisation; nobody can change another
    person's picture.
13. Several roles per person, people search, organisation settings.
    Test: an admin gives a student the Volunteer role too and the student
    sees Leads; a student cannot give themselves a role; an admin cannot
    remove their own Admin role.
14. Data safety (see "Data safety"). Test: a teacher cannot delete
    programmes; a teacher with batches cannot delete their account; ticking
    Evening on a second phone keeps the Morning tick; a batch with more than
    1,000 check-ins shows every day on the teacher screen.
15. Speed and safety net: faster access rules and indexes, automatic checks
    on every pull request, error reports for admins, smaller app download,
    offline ticks. Test: verify.sql passes in GitHub on a pull request; a
    tick made in airplane mode appears after reconnecting.
16. Easier for older users: one pop-up style everywhere (keyboard and screen
    reader friendly), larger text and 44 px buttons, zoom allowed, messages at
    the bottom of the screen, a calmer student home, a clearer People page.
    Test: every pop-up closes with Escape; on a phone the text can be zoomed;
    a volunteer opens on Leads; a person with one role sees no view switcher.
17. Languages: English, Arabic (right to left) and Hindi for everything a
    student sees; the trail shows Morning as the top half and Evening as the
    bottom half of a day. Test: switch to Arabic on the consent screen and the
    layout turns right to left; a morning-only day shows its top half green.

## Out of scope (do not build)
Community or chat, payments, native mobile apps, organisation self-signup,
billing, per-organisation domains, accounting, inventory, HR, a platform
owner screen (I manage organisations in the Supabase table editor).
Notifications and integrations only as described for CRM invites and
practice reminders above.

https://github.com/annakhtoniv/sadhana-mandala.git
