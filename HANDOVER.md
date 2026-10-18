# Sadhana Mandala: handover for a new chat

Updated 2026-10-18, after Phase 17. Read this first, then [PROGRESS.md](PROGRESS.md) (what was built, phase by phase), [SPEC.md](SPEC.md) (what the app must do) and [supabase/README.md](supabase/README.md) (SQL run order).

## 1. The project in one paragraph

Sadhana Mandala is a white-label web app (installable PWA) for a meditation organisation in Dubai (Art of Living style programmes). It follows one person from the first meeting with a volunteer, through an intro talk and a programme (Happiness Program, Art of Silence, Sahaj, Sri Sri Yoga, VTP, AMP), to 40 days of daily practice (Morning and Evening ticks) and the next programme. Users: students (many older, phone first, some prefer Arabic or Hindi), volunteers (leads / CRM), teachers (batches, roster, follow-ups) and admins (people, roles, programmes, reports). One person can hold several roles. Sign-in is Google only.

## 2. Where everything is

| What | Where |
| --- | --- |
| Live site | https://sadhana.zyxenai.com (GitHub Pages, deploys on every push to `main` via `.github/workflows/pages.yml`) |
| Repository | `annakhtoniv/sadhana-mandala` |
| Working branch | `claude/gifted-lovelace-1qlelj` (restart it from `main` after each merged PR; the PM deletes it after merging) |
| Database | Supabase project `pshapxojprvgmwhdivim` (region ap-northeast-2, Seoul), free plan |
| Organisations | Org A `sadhana-mandala` (the real one), Org B `prana-flow` (test second tenant) |
| Real accounts | annakhtoniv@gmail.com (PM, admin); Shubham Ji blessedshubh@gmail.com (admin; teaches the real batch "Lotus"); the PM also has a real batch "AOS40" |
| Sample data | `supabase/seed_dummy_data.sql`: fictional `@example.com` people, batches (join code AUTUMN23 = Happiness Program at day 23), leads, events. Re-run it the morning of a demo so the days line up again |
| Earlier reports | Stress test and expert review: https://claude.ai/code/artifact/5b1d790c-6361-40a4-a766-fa1ff8712375 · UX review brief for Vignesh: https://claude.ai/artifact/9bwnmrqzhuCeShFw88gd5m |

## 3. Stack and code map

React 18 + TypeScript + Tailwind 3 + Vite 6 + vite-plugin-pwa; Supabase JS v2; lucide-react icons; vitest. No router, no state library: `App.tsx` switches tabs (`home`, `lessons`, `events`, `leads`, `profile`) and the home screen by active role.

- `src/App.tsx` sign-in page, consent gate, header and tab bar, bottom toast, lazy staff screens (AdminHome, TeacherHome, CrmScreen).
- `src/context/AuthContext.tsx` session, profile, roles, active view, enrolments, consent, delete account, notices.
- `src/i18n/` English / Arabic / Hindi (Phase 17): `en.ts` is the source; `ar.ts` and `hi.ts` are typed `Record<MsgKey, string>` so a missing key fails the build; `locale.ts` holds the current language for non-React code (dates, errors); `useT()` / `useI18n()`; Arabic sets `dir="rtl"` on `<html>`. Admin, teacher and Leads screens are still English only.
- `src/components/` screens. Shared UI: `Sheet.tsx` (the one pop-up: focus trap, Escape, `ConfirmProvider` / `useConfirm` replace `window.confirm`), `LanguageSwitch.tsx`, `ErrorBoundary.tsx`, `RolePicker.tsx` (dropdown on computer, bottom sheet on phone).
- Student: `StudentHome`, `PracticeCheckin` (ticks, trail, flame), `ProgrammeLearning`, `ProgrammeMaterials`, `ProgrammeFollowups`, `LessonsScreen`, `EventsScreen`, `ProfileScreen`, `ConsentModal`, `GuidedTour`.
- Staff: `AdminHome` (Batches / People / Programmes / Reports), `TeacherHome`, `TeacherBatchDetail`, `BatchEditor`, `ProgrammesManager`, `ModulesEditor`, `MaterialsEditor`, `FollowupPlanEditor`, `EventManager`, `CrmScreen`, `CrmContactDetail`, `FunnelReportPanel`, `ClientErrorsPanel`, `OrganisationSettings`.
- `src/lib/` services and pure logic: `checkinService` (single-tick upsert, paging), `practiceUtils` (trail status `full|morning|evening|missed|today|future`, streak, quiet), `batchService`, `crmService`, `eventService`, `lmsService`, `followupService`, `materialsService`, `avatarService`, `paging.ts` (`fetchAllPages`, Supabase caps responses at 1,000 rows), `errors.ts` (`friendlyError`, translated), `offlineTicks.ts`, `errorReporting.ts`, `roles.ts` (`hasRole`, `rolesOf`, `primaryRole`).
- `src/types/` `database.ts` (hand-written), `supabase.generated.ts` (from the schema), `schemaDrift.ts` (compile-time check between them).
- Design: classes in `src/index.css`: `ui-card`, `ui-btn-primary`, `ui-btn-ghost`, `ui-icon-btn` (44 px), `ui-input`, `ui-label`, `ui-eyebrow`, `user-text` (admin-typed text keeps its own direction). "stone" colours are remapped to zinc in `tailwind.config.js`. No dark mode. Use logical spacing (`ms/me/ps/pe/start/end`) so Arabic mirrors. Fonts: Geist, Noto Sans Arabic, Noto Sans Devanagari.

## 4. Database

- RLS on every table, security-definer helpers with pinned `search_path`, policies written with the `(select fn())` pattern and helper id lists (Phase 15). Teachers see only their own batches and leads; students only their own data.
- SQL files run in order: see `supabase/README.md`. All phases up to 15 are live. Latest live verify: **122/122 PASS** (2026-10-18).
- `supabase/verify.sql` = the test suite (runs as each persona, undoes itself with an inner `VERIFY_UNDO` block). Run with "Run without RLS" in the SQL editor.
- `supabase/ci/` = a schema baseline so GitHub can rebuild the database from the repo.
- Never run anything in `supabase/archive/` (old, unsafe; guarded by a `raise exception`).

## 5. How we work (PM preferences)

- The PM (annakhtoniv) works like a product manager: approves features, merges PRs and deletes the branch, and runs SQL in the Supabase dashboard using the Supabase Claude sidebar.
- For SQL, give the PM a ready-to-paste sidebar prompt: raw GitHub links on `main` (`https://raw.githubusercontent.com/annakhtoniv/sadhana-mandala/main/supabase/<file>.sql`), the expected last line of each file, the expected result ("Success. No rows returned" or "N rows, all PASS"), "Run without RLS" for verify, and warn in advance that Supabase shows a destructive-operation warning for files that drop and recreate policies.
- Plain, non-technical language in replies; tables for comparisons; honest about anything not tested.
- Every PR: draft, CI must be green (`.github/workflows/checks.yml`: App job = tsc, vitest, build; Database job = rebuild + verify.sql twice). Update PROGRESS.md and SPEC.md in the same PR.
- Before pushing: `npx tsc --noEmit -p .`, `npx vitest run` (121 tests), `npm run build`, and a browser check with Playwright against a local copy when the UI changes.
- WhatsApp updates to Shubham Ji: the last one was sent 2026-10-18 (covers everything up to Phase 17). Style: "🙏 Jai Gurudev Shubham Ji", numbered bold sections with an emoji, bullets, short lines, "sample data" note, ask for feedback.

## 6. Local testing setup (used in earlier sessions, rebuild if the container is new)

Postgres 16 on port 5499 with the Supabase roles and schema, PostgREST, and a small Node gateway on port 8787 that fakes Supabase auth (signed JWTs), REST and storage; the app is built with `VITE_SUPABASE_URL=http://localhost:8787` and served by `vite preview`; Playwright (preinstalled Chromium) injects a session into `localStorage` (`sb-localhost-auth-token`) and the language into `sadhana_lang`. These scripts lived in the session scratchpad, not in the repo; rebuild from `supabase/ci` + the phase files + seed if needed.

## 7. State right now

- `main` = Phase 17 (PR #18 merged). Nothing open. Working branch equals `main`.
- Phases 11 to 17 live: Morning/Evening ticks and trail halves (top half = Morning, bottom = Evening), past-day fill-in, study materials, profile photos, multi-role, People page with filters, data-safety rules, faster RLS, CI, error reports, offline ticks, shared Sheet, larger text and targets, three languages.
- Stress test: 509 sign-ins with 0 errors; API steady up to 3,200 simultaneous users, comfortable under about 250 at once on a 4-core machine; with a year of data, Phase 15 made the roster 170 ms to 2.4 ms.

## 8. Open items and decisions waiting on the PM

1. Native speakers to check the Arabic and Hindi text.
2. Translate the staff screens (admin, teacher, Leads) too?
3. Vignesh's UX feedback (brief above); turn his comments into fixes.
4. Shubham Ji's feedback on the WhatsApp update.
5. Before the first real batch: clear the sample data (all `@example.com` people, seeded batches, leads, events) in both organisations; decide whether Org B stays; get the lead consent wording (PDPL) approved.
6. Infrastructure: Supabase Pro (about 25 USD a month; free plan pauses after 7 idle days, a daily keep-alive job covers that), move the database closer to Dubai, optional staging project, auth settings (Google only, exact redirect list, admin MFA), point-in-time recovery.
7. Known UX gaps: Google-only sign-in; long teacher roster with no Quiet filter; admin home does a lot; long lead form; short onboarding for staff.
8. Possible later work: automatic invites by email or WhatsApp (needs a provider and approved consent text), a data layer such as TanStack Query, splitting AdminHome further.
