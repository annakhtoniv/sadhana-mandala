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
   --- DEMO CUT LINE ---
5. Lessons (create, publish, read) with placeholder content.
6. Admin screens.
7. PWA install, empty states, error messages, final polish.

## Out of scope (do not build)
Community or chat, payments, notifications or reminders, integrations with
other tools, native mobile apps, organisation self-signup, billing,
per-organisation domains, a platform owner screen (I manage organisations in
the Supabase table editor).

https://github.com/annakhtoniv/sadhana-mandala.git
