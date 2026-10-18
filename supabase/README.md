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
12. `seed_dummy_data.sql` (resets the sample data; real accounts are never touched)
13. `verify.sql` (every row PASS)

## Never run

`archive/` holds old scripts that made people admin or removed security
rules. They stop at their first line on purpose.
