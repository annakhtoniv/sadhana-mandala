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

## Next

11. `phase14_safety.sql` (data safety)
12. `phase15_performance.sql` (faster access rules, indexes, error log)
13. `seed_dummy_data.sql` (resets the sample data; real accounts are never touched)
14. `verify.sql` (every row PASS)

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
