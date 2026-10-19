# Supabase SQL files

Run new files in the Supabase SQL editor (project `pshapxojprvgmwhdivim`), from
`main`, one at a time, in the order below. Every file is safe to run more than
once. `verify.sql` must end with every row saying PASS.

## Already applied to the live project, in this order

1. `schema.sql`, `schema_phase2.sql`, `schema_phase3.sql` (first set-up)
2. `phase4_security.sql` (replaced the first, unsafe policies)
3. `phase5_programmes.sql`
4. `phase6_lms.sql`
5. `phase7_followups.sql`
6. `phase8_events.sql`
7. `phase9_crm.sql`
8. `phase11_checkins.sql`
9. `phase12_media.sql`
10. `phase13_roles.sql`
11. `phase14_safety.sql` (data safety)
12. `phase15_performance.sql` (faster access rules, indexes, error log)
13. `phase18_reminders.sql` (daily practice reminders; 2026-10-18)
14. `phase19_signin_handoff.sql` (the iPhone Home Screen app stays signed in; 2026-10-19)
15. `phase20_batch_end_date.sql` (every batch has an end date; 2026-10-19)

Latest `verify.sql` on the live project: 146 rows, all PASS (2026-10-19).

## Before running verify.sql

Run `seed_dummy_data.sql` the same day (it resets the sample data; real
accounts are never touched, but their enrolments and registrations in sample
batches and events are removed). Then `verify.sql` with "Run without RLS":
every row must say PASS.

## Next

1. Make a key pair on your own computer: `npx web-push generate-vapid-keys`.
    Set the Edge Function `functions/send-reminders` secrets (Supabase > Edge
    Functions > Secrets): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
    `VAPID_SUBJECT` (`mailto:` the support email). Put the same public key in
    GitHub > Settings > Secrets and variables > Actions > Variables as
    `VITE_VAPID_PUBLIC_KEY`, then publish the site again. The private key is
    never put in the repository or in a chat.
2. `phase18_schedule.sql` (starts the sender every 5 minutes; live project only)

## Automatic checks (GitHub)

Every pull request rebuilds this database in GitHub from
`ci/00_roles.sql` and `ci/01_baseline_after_phase13.sql` (the live schema
after Phase 13), applies the newer phase files, the sample data and
`verify.sql` twice (`.github/workflows/checks.yml`). When you add a phase file,
add it to the list in that workflow too.

## A test copy of Supabase (optional, recommended before real batches)

1. supabase.com > New project (free), name it `sadhana-staging`, region Middle East or EU.
2. In its SQL editor run, in order: `ci/00_roles.sql` is not needed there; run
   `schema.sql`, `schema_phase2.sql`, `schema_phase3.sql`, then every phase file above, then the seed.
3. GitHub > Settings > Secrets and variables > Actions > Variables: the site uses
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` when they are set (the live
   values are the fallback). Point a second deploy at the staging project to
   try changes before they reach the live site.

## Never run

`archive/` holds old scripts that made people admin or removed security
rules. They stop at their first line on purpose.
