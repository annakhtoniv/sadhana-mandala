# Sadhana Mandala: handover for a new chat

Updated 2026-10-19, after Phase 18 (daily reminders) and the automatic-update fix. Read this first, then [PROGRESS.md](PROGRESS.md) (what was built, phase by phase), [SPEC.md](SPEC.md) (what the app must do) and [supabase/README.md](supabase/README.md) (SQL run order).

## 1. The project in one paragraph

Sadhana Mandala is a white-label web app (installable PWA) for a meditation organisation in Dubai (Art of Living style programmes). It follows one person from the first meeting with a volunteer, through an intro talk and a programme (Happiness Program, Art of Silence, Sahaj, Sri Sri Yoga, VTP, AMP), to 40 days of daily practice (Morning and Evening ticks) and the next programme. Users: students (many older, phone first, some prefer Arabic or Hindi), volunteers (leads / CRM), teachers (batches, roster, follow-ups) and admins (people, roles, programmes, reports). One person can hold several roles. Sign-in is Google only.

## 2. Where everything is

| What | Where |
| --- | --- |
| Live site | https://sadhana.zyxenai.com (GitHub Pages, deploys on every push to `main` via `.github/workflows/pages.yml`) |
| Repository | `annakhtoniv/sadhana-mandala` |
| Working branch | `claude/charming-bardeen-dbau1g` (restart it from `main` after each merged PR; the PM deletes it after merging) |
| Database | Supabase project `pshapxojprvgmwhdivim` (region ap-northeast-2, Seoul), free plan |
| Organisations | Org A `sadhana-mandala` (the real one), Org B `prana-flow` (test second tenant) |
| Real accounts | annakhtoniv@gmail.com (PM, admin); Shubham Ji blessedshubh@gmail.com (admin; teaches the real batch "Lotus"); the PM also has a real batch "AOS40" |
| Sample data | `supabase/seed_dummy_data.sql`: fictional `@example.com` people, batches (join code AUTUMN23 = Happiness Program at day 23), leads, events. Re-run it the morning of a demo so the days line up again |
| Earlier reports | Stress test and expert review: https://claude.ai/code/artifact/5b1d790c-6361-40a4-a766-fa1ff8712375 · UX review brief for Vignesh: https://claude.ai/artifact/9bwnmrqzhuCeShFw88gd5m |

## 3. Stack and code map

React 18 + TypeScript + Tailwind 3 + Vite 6 + vite-plugin-pwa; Supabase JS v2; lucide-react icons; vitest. No router, no state library: `App.tsx` switches tabs (`home`, `lessons`, `events`, `leads`, `profile`) and the home screen by active role.

- `src/main.tsx` entry; imports `lib/appUpdate.ts`, which registers the service worker and reloads the page once when a new version takes over (checks on open and when the person returns to the app, never while they stay on screen). `vite.config.ts`: workbox `skipWaiting` + `clientsClaim`, `injectRegister: false`, `importScripts: ['push-handler.js']`.
- `src/App.tsx` sign-in page, consent gate, header and tab bar, bottom toast, lazy staff screens (AdminHome, TeacherHome, CrmScreen).
- `src/context/AuthContext.tsx` session, profile, roles, active view, enrolments, consent, delete account, notices.
- `src/i18n/` English / Arabic / Hindi (Phase 17): `en.ts` is the source; `ar.ts` and `hi.ts` are typed `Record<MsgKey, string>` so a missing key fails the build; `locale.ts` holds the current language for non-React code (dates, errors); `useT()` / `useI18n()`; Arabic sets `dir="rtl"` on `<html>`. Admin, teacher and Leads screens are still English only.
- `src/components/` screens. Shared UI: `Sheet.tsx` (the one pop-up: focus trap, Escape, `ConfirmProvider` / `useConfirm` replace `window.confirm`), `LanguageSwitch.tsx`, `ErrorBoundary.tsx`, `RolePicker.tsx` (dropdown on computer, bottom sheet on phone).
- Student: `StudentHome`, `PracticeCheckin` (ticks, trail, flame), `ProgrammeLearning`, `ProgrammeMaterials`, `ProgrammeFollowups`, `LessonsScreen`, `EventsScreen`, `ProfileScreen`, `ConsentModal`, `GuidedTour`.
- Staff: `AdminHome` (Batches / People / Programmes / Reports), `TeacherHome`, `TeacherBatchDetail`, `BatchEditor`, `ProgrammesManager`, `ModulesEditor`, `MaterialsEditor`, `FollowupPlanEditor`, `EventManager`, `CrmScreen`, `CrmContactDetail`, `FunnelReportPanel`, `ClientErrorsPanel`, `OrganisationSettings`.
- `src/lib/` services and pure logic: `checkinService` (single-tick upsert, paging), `practiceUtils` (trail status `full|morning|evening|missed|today|future`, streak, quiet), `batchService`, `crmService`, `eventService`, `lmsService`, `followupService`, `materialsService`, `avatarService`, `paging.ts` (`fetchAllPages`, Supabase caps responses at 1,000 rows), `errors.ts` (`friendlyError`, translated), `offlineTicks.ts`, `errorReporting.ts`, `roles.ts` (`hasRole`, `rolesOf`, `primaryRole`).
- Reminders (Phase 18): `lib/pushReminders.ts` (permission, subscribe, save/remove the phone via RPC, `forgetRemindersOnThisPhone` on sign-out), `components/RemindersCard.tsx` (Profile; compact card on the student home while a practice runs), `public/push-handler.js` (service worker: shows the notification, opens the app on tap), reminder times/texts in `OrganisationSettings`. Sender: `supabase/functions/send-reminders` (Edge Function, `npm:web-push`), started by `supabase/phase18_schedule.sql` (pg_cron + pg_net, every 5 minutes). The public VAPID key comes only from the GitHub Actions variable `VITE_VAPID_PUBLIC_KEY`; the private key is only a Supabase Edge Function secret.
- `src/types/` `database.ts` (hand-written), `supabase.generated.ts` (from the schema), `schemaDrift.ts` (compile-time check between them).
- Design: classes in `src/index.css`: `ui-card`, `ui-btn-primary`, `ui-btn-ghost`, `ui-icon-btn` (44 px), `ui-input`, `ui-label`, `ui-eyebrow`, `user-text` (admin-typed text keeps its own direction). "stone" colours are remapped to zinc in `tailwind.config.js`. No dark mode. Use logical spacing (`ms/me/ps/pe/start/end`) so Arabic mirrors. Fonts: Geist, Noto Sans Arabic, Noto Sans Devanagari.

## 4. Database

- RLS on every table, security-definer helpers with pinned `search_path`, policies written with the `(select fn())` pattern and helper id lists (Phase 15). Teachers see only their own batches and leads; students only their own data.
- SQL files run in order: see `supabase/README.md`. All phases up to 18 are live (`phase18_reminders.sql` ran 2026-10-18). Latest live verify: 137 rows, 136 PASS; the one FAIL was the time-based "QR check-in to the event happening now" (the seeded event had ended), fixed by re-running the seed; the re-run result was not reported back yet.
- `supabase/verify.sql` = the test suite (runs as each persona, undoes itself with an inner `VERIFY_UNDO` block). Run with "Run without RLS" in the SQL editor.
- `supabase/ci/` = a schema baseline so GitHub can rebuild the database from the repo.
- Some checks depend on the time of day (events "happening now", batch days): re-run the seed before verify if it was seeded hours earlier.
- Never run anything in `supabase/archive/` (old, unsafe; guarded by a `raise exception`).

## 5. How we work (PM preferences)

- The PM (annakhtoniv) works like a product manager: approves features, merges PRs and deletes the branch, and runs SQL in the Supabase dashboard using the Supabase Claude sidebar.
- For SQL, give the PM a ready-to-paste sidebar prompt: raw GitHub links on `main` (`https://raw.githubusercontent.com/annakhtoniv/sadhana-mandala/main/supabase/<file>.sql`), the expected last line of each file, the expected result ("Success. No rows returned" or "N rows, all PASS"), "Run without RLS" for verify, and warn in advance that Supabase shows a destructive-operation warning for files that drop and recreate policies.
- Plain, non-technical language in replies; tables for comparisons; honest about anything not tested.
- Every PR: draft, CI must be green (`.github/workflows/checks.yml`: App job = tsc, vitest, build; Database job = rebuild + verify.sql twice). Update PROGRESS.md and SPEC.md in the same PR.
- Before pushing: `npx tsc --noEmit -p .`, `npx vitest run` (123 tests; GitHub uses Node 20, so a test must not load the real Supabase client: stub `../supabase` with `vi.mock`, check with `NODE_OPTIONS=--no-experimental-websocket`), `npm run build`, and a browser check with Playwright against a local copy when the UI changes.
- Never put private keys or other secrets in the chat or in a file sent to the PM: the PM enters secrets in Supabase / GitHub themselves (the first reminder key pair was abandoned for this reason). Only public keys may pass through Claude.
- The Supabase connector here can read (`execute_sql`) and deploy Edge Functions, but `apply_migration` and secret creation timed out waiting for an approval the PM never saw: give SQL to the PM instead.
- WhatsApp updates to Shubham Ji: the last one sent was 2026-10-18 (covers everything up to Phase 17). A next one (automatic updates, daily reminders, new icon) was drafted 2026-10-18, to send once reminders are switched on. Style: "🙏 Jai Gurudev Shubham Ji", numbered bold sections with an emoji, bullets, short lines, "sample data" note, ask for feedback.

## 6. Local testing setup (used in earlier sessions, rebuild if the container is new)

Postgres 16 on port 5499 with the Supabase roles and schema, PostgREST, and a small Node gateway on port 8787 that fakes Supabase auth (signed JWTs), REST and storage; the app is built with `VITE_SUPABASE_URL=http://localhost:8787` and served by `vite preview`; Playwright (preinstalled Chromium) injects a session into `localStorage` (`sb-localhost-auth-token`) and the language into `sadhana_lang`. These scripts lived in the session scratchpad, not in the repo; rebuild from `supabase/ci` + the phase files + seed if needed.

## 7. State right now

- `main` = PR #24 merged (handover). Phase 19 (Events fixes + staying signed in on the iPhone Home Screen app) is in a draft PR on `claude/charming-bardeen-dbau1g`; after merging, run `phase19_signin_handoff.sql` and `phase20_batch_end_date.sql` and add the redirect URL (supabase/README.md steps 18 and 19).
- Sign-in (Phase 19): PKCE (`lib/supabase.ts`); `lib/signInHandoff.ts` hands a sign-in that finished in the iPhone's Safari window to the Home Screen app through `put_auth_handoff` / `take_auth_handoff`; sign-out is this device only (`scope: 'local'`). The auth logs showed the PM's 18 Oct 22:40 sign-in landed in Safari (user agent with `Safari/604.1`) and the app never used it.
- Live on 2026-10-18: PR #20 (handover branch name), #21 (the site updates itself; phones that had an older version need two reloads once), #22 + #23 (daily reminders).
- Phases 11 to 18: Morning/Evening ticks and trail halves, past-day fill-in, study materials, profile photos, multi-role, People page, data-safety rules, faster RLS, CI, error reports, offline ticks, shared Sheet, larger text, three languages, daily push reminders (Morning 06:00 and Evening 19:00 Dubai by default, to everyone in a running practice batch who turned them on, also if they already ticked).
- Reminders are **built but not sending yet**. Done: tables and functions (live), Edge Function `send-reminders` deployed. Not done (checked 2026-10-19: pg_cron not installed, 0 phones, 0 sends): see open item 1.
- Home Screen icon: the green mandala is live; iPhones that added the shortcut earlier keep the old "S" until it is removed and added again.
- Stress test: 509 sign-ins with 0 errors; API steady up to 3,200 simultaneous users, comfortable under about 250 at once on a 4-core machine; with a year of data, Phase 15 made the roster 170 ms to 2.4 ms.

## 8. Open items and decisions waiting on the PM

1. Switch reminders on (`supabase/README.md` steps 16 and 17): the PM makes a new key pair on their own computer (`npx web-push generate-vapid-keys`), adds Supabase secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:support@zyxenai.com`) and the GitHub Actions variable `VITE_VAPID_PUBLIC_KEY`, re-runs "Deploy to GitHub Pages" if the variable was added after the PR #23 deploy, then runs `phase18_schedule.sql`. Then test: Home Screen app > Profile > Daily reminders > Turn on; Admin > Organisation settings > Morning time 2 minutes ahead; check `reminder_sends` (phones column) with `execute_sql`. Never tried on a real phone yet.
2. Send the drafted WhatsApp update to Shubham Ji after item 1.
3. Native speakers to check the Arabic and Hindi text.
4. Translate the staff screens (admin, teacher, Leads) too?
5. Vignesh's UX feedback (brief above); turn his comments into fixes.
6. Shubham Ji's feedback on the WhatsApp updates.
7. Before the first real batch: clear the sample data (all `@example.com` people, seeded batches, leads, events) in both organisations; decide whether Org B stays; get the lead consent wording (PDPL) approved.
8. Infrastructure: Supabase Pro (about 25 USD a month; free plan pauses after 7 idle days, a daily keep-alive job covers that), move the database closer to Dubai, optional staging project, auth settings (Google only, exact redirect list, admin MFA), point-in-time recovery.
9. Known UX gaps: the reminder text is one language (as the admin types it); Google-only sign-in; long teacher roster with no Quiet filter; admin home does a lot; long lead form; short onboarding for staff.
10. Possible later work: automatic invites by email or WhatsApp (needs a provider and approved consent text), a data layer such as TanStack Query, splitting AdminHome further.

## 9. Drafted WhatsApp update for Shubham Ji (not sent yet)

Send after reminders are switched on (open item 1); otherwise change section 2 to "coming in the next day or two".

```
🙏 *Jai Gurudev Shubham Ji*

A few more improvements to the Sadhana app since my last message:

*1. 🔄 Always the latest version*
• The app now updates itself whenever you open it.
• No need to clear anything or use a private window any more.
• One-time step: open sadhana.zyxenai.com and refresh the page *twice*. After that, every update arrives on its own.

*2. 🔔 Daily practice reminders*
• Students get a gentle notification every *morning and evening* for their practice.
• Each student turns it on with one tap: *Profile → Daily reminders → Turn on reminders*.
• On iPhone, reminders work when the app is opened from the *Home Screen icon* (Safari → Share → Add to Home Screen).
• As admin, you can change the *times and the message* under *Admin → Organisation settings → Daily practice reminders*. Right now: 6:00 am and 7:00 pm (Dubai time).

*3. 🪷 New app icon*
• The Home Screen icon is now the green mandala.
• If you added the app earlier and still see an "S", remove the icon and add it again from Safari.

The batches and names you see are still *sample data* for testing.

Whenever you have a moment, please try turning on the reminders and tell me how they feel: the timing, and the wording of the message. Your feedback means a lot 🙏
```
