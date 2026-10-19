# Sadhana Mandala: handover for a new chat

Updated 2026-10-19 (evening), after PR #25: UX review fixes, staying signed in on the iPhone Home Screen app (Phase 19) and batch end dates (Phase 20). Read this first, then [PROGRESS.md](PROGRESS.md) (what was built, phase by phase), [SPEC.md](SPEC.md) (what the app must do) and [supabase/README.md](supabase/README.md) (SQL run order).

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
- Sign-in (Phase 19): PKCE (`lib/supabase.ts`). `lib/signInHandoff.ts` hands a sign-in that finished in the iPhone's Safari window to the Home Screen app through `put_auth_handoff` / `take_auth_handoff` (table `auth_handoffs`, one-time, 10 minutes); `AuthContext` passes the code on (Safari window) or picks it up (app, every few seconds and on return). Google's code is a UUID, so `joinLink.isAuthCode` keeps it apart from batch join codes (`?code=`). Sign-out is this device only (`scope: 'local'`).
- Batch dates (Phase 20): `batches.end_date` (not null, never before `start_date`; a trigger fills it from the programme when left empty). `programmeUtils.defaultBatchEndDate` mirrors the rule; `dateUtils.formatDateRange` shows "14 Oct – 22 Nov 2026".
- `src/types/` `database.ts` (hand-written), `supabase.generated.ts` (from the schema), `schemaDrift.ts` (compile-time check between them).
- Design: classes in `src/index.css`: `ui-card`, `ui-btn-primary`, `ui-btn-ghost`, `ui-icon-btn` (44 px), `ui-input`, `ui-label`, `ui-eyebrow`, `user-text` (admin-typed text keeps its own direction). "stone" colours are remapped to zinc in `tailwind.config.js`. No dark mode. Use logical spacing (`ms/me/ps/pe/start/end`) so Arabic mirrors. Fonts: Geist, Noto Sans Arabic, Noto Sans Devanagari.

## 4. Database

- RLS on every table, security-definer helpers with pinned `search_path`, policies written with the `(select fn())` pattern and helper id lists (Phase 15). Teachers see only their own batches and leads; students only their own data.
- SQL files run in order: see `supabase/README.md`. All phases up to 20 are live (`phase19_signin_handoff.sql` and `phase20_batch_end_date.sql` ran 2026-10-19). Latest live verify (2026-10-19, after re-running the seed): 146 rows, all PASS. Not run yet: `phase18_schedule.sql` (needs the reminder keys first).
- `supabase/verify.sql` = the test suite (runs as each persona, undoes itself with an inner `VERIFY_UNDO` block). Run with "Run without RLS" in the SQL editor.
- `supabase/ci/` = a schema baseline so GitHub can rebuild the database from the repo.
- Some checks depend on the time of day (events "happening now", batch days): re-run the seed on the same day, before verify. The seed rebuilds the sample batches and events, so it also removes real people's enrolments and registrations in them (real accounts stay). A real tester joining a sample batch (Vignesh did, with AUTUMN23) makes the roster checks fail until the next seed.
- Never run anything in `supabase/archive/` (old, unsafe; guarded by a `raise exception`).

## 5. How we work (PM preferences)

- The PM (annakhtoniv) works like a product manager: approves features, merges PRs and deletes the branch, and runs SQL in the Supabase dashboard using the Supabase Claude sidebar.
- For SQL, give the PM a ready-to-paste sidebar prompt: raw GitHub links on `main` (`https://raw.githubusercontent.com/annakhtoniv/sadhana-mandala/main/supabase/<file>.sql`), the expected last line of each file, the expected result ("Success. No rows returned" or "N rows, all PASS"), "Run without RLS" for verify, and warn in advance that Supabase shows a destructive-operation warning for files that drop and recreate policies.
- Plain, non-technical language in replies; tables for comparisons; honest about anything not tested.
- Every PR: draft, CI must be green (`.github/workflows/checks.yml`: App job = tsc, vitest, build; Database job = rebuild + verify.sql twice). Update PROGRESS.md, SPEC.md and this file in the same PR. A new phase file also goes into the list in `checks.yml` and into `supabase/README.md`.
- Before pushing: `npx tsc --noEmit -p .`, `npx vitest run` (137 tests; GitHub uses Node 20, so a test must not load the real Supabase client: stub `../supabase` with `vi.mock`, check with `NODE_OPTIONS=--no-experimental-websocket`), `npm run build`, and a browser check with Playwright against a local copy when the UI changes.
- Never put private keys or other secrets in the chat or in a file sent to the PM: the PM enters secrets in Supabase / GitHub themselves (the first reminder key pair was abandoned for this reason). Only public keys may pass through Claude.
- The Supabase connector here can read (`execute_sql`) and deploy Edge Functions, but `apply_migration` and secret creation timed out waiting for an approval the PM never saw: give SQL to the PM instead.
- The PM's Supabase sidebar runs SQL in the dashboard's SQL editor (its direct connection timed out); it confirms the destructive-operation warning after checking it only comes from drop-and-recreate lines.
- UX feedback arrives as PDF reports ("... UX Validation Report", screenshot-based). Check each finding against the code and data first: several were sample data or misreadings (e.g. "Cancelled" meant the viewer's own place). Give the PM the list, then build.
- WhatsApp updates to Shubham Ji: see section 9. Style: "🙏 Jai Gurudev Shubham Ji", numbered bold sections with an emoji, bullets, short lines, "sample data" note, ask for feedback.

## 6. Local testing setup (rebuild if the container is new; scripts live in the session scratchpad, not the repo)

- Database: Postgres 16 (`/usr/lib/postgresql/16/bin`, run as user `postgres`, data in `~postgres/pgdata`, port 5499, socket `/tmp`). Load the files in the CI order from `checks.yml`, then run `verify.sql` twice (`psql -At -F '|'`, count `|PASS$` / `|FAIL$`).
- UI: `npm run build` with `VITE_SUPABASE_URL=https://pshapxojprvgmwhdivim.supabase.co`, `npx vite preview --port 4173`, then Playwright (global install under `/opt/node22/lib/node_modules/playwright`, Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). `page.route` answers `**/rest/v1/**` and `**/auth/v1/**` with fake data (organisation, profile, enrolment with batch and course, check-ins, events, RPCs) and blocks Google fonts. `addInitScript` puts a session in `localStorage` (`sb-pshapxojprvgmwhdivim-auth-token`, with `expires_at` in the future) and the language in `sadhana_lang`. Nothing touches the live database. Check English, Arabic and Hindi at 375 px (and 320 px), and that nothing scrolls sideways.
- An older setup (PostgREST + a fake auth gateway on port 8787) was used in earlier sessions; the route-mocking approach above is simpler.

## 7. State right now

- `main` = PR #26 merged (2026-10-19). Phases 21 (weekly badges, photo frames, day-by-day report, dates on the trail, reminders that cheer on the week) and 22 (reminders in each language, quiet evening, share a badge, encouragement, milestones, certificate, Excel, reflections) are in PR #27; after merging: run `phase21_badges.sql` then `phase22_engagement.sql`, re-run the seed and verify, redeploy `send-reminders` (index.ts + motivation.ts). The working branch is restarted from `main` for each new PR.
- Live and checked on 2026-10-19:
  - UX review fixes (three reports: Events, Happiness Programme, Profile & Settings). Events: "You cancelled your place" / "Register again", one wording for places, places and the button stacked on the right beside the description, Dubai time everywhere, results on the card. Practice: soft Morning #FFF0C2/#6B4A00 and Evening #E9E7FF/#302777 (PM approved) with a coloured edge and filled tick, "This week" count separate from "So far: x of y". Profile: honest reminders message ("not switched on yet"), fuller privacy text, consent time with "(Dubai time)". Join code example "From your teacher".
  - Staying signed in on the iPhone Home Screen app: the PM signed in on a real iPhone, closed and reopened the app, and stayed signed in; the auth records show the session renewing. Other iPhone users may need to sign in once more.
  - Every batch has an end date: Lotus 14 Oct – 22 Nov 2026. AOS40 shows 17–17 Oct because Art of Silence has no programme length (same for the Volunteer Training Program).
  - Tighter spacing on every main screen at phone width.
- Reminders are **built but not sending yet** (no keys, no pg_cron job, 0 phones). The Profile card says reminders are not switched on yet.
- Phases 11 to 18 (earlier): Morning/Evening ticks and trail halves, past-day fill-in, study materials, profile photos, multi-role, People page, data-safety rules, faster RLS, CI, error reports, offline ticks, shared Sheet, larger text, three languages, daily push reminders, automatic updates (phones that had an older version need two reloads once), the green mandala icon.
- Stress test: 509 sign-ins with 0 errors; API steady up to 3,200 simultaneous users, comfortable under about 250 at once on a 4-core machine; with a year of data, Phase 15 made the roster 170 ms to 2.4 ms.

## 8. Open items and decisions waiting on the PM

1. Confirm `https://sadhana.zyxenai.com/**` is in Supabase > Authentication > URL Configuration > Redirect URLs (asked 2026-10-19; not confirmed).
2. Programme lengths: Shubham Ji was asked how many days Art of Silence is. Then set it (and the Volunteer Training Program's) in Admin > Programmes, or edit the AOS40 end date. A length change does not move existing batches' end dates; edit those batches.
3. Switch reminders on (`supabase/README.md`, section Next): the PM makes a new key pair on their own computer (`npx web-push generate-vapid-keys`), adds Supabase secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:support@zyxenai.com`) and the GitHub Actions variable `VITE_VAPID_PUBLIC_KEY`, re-runs "Deploy to GitHub Pages", then runs `phase18_schedule.sql`. Test: Home Screen app > Profile > Daily reminders > Turn on; Admin > Organisation settings > Morning time 2 minutes ahead; check `reminder_sends` with `execute_sql`. Never tried on a real phone yet.
4. WhatsApp to Shubham Ji (section 9): send the follow-up if not sent yet; once reminders work, send the short "reminders are on" note.
5. Optional: make `verify.sql` count only `@example.com` people, so a tester in a sample batch does not break the roster checks.
6. Native speakers to check the Arabic and Hindi (strings added on 19 Oct were translated by Claude).
7. Translate the staff screens (admin, teacher, Leads) too?
8. Vignesh's UX feedback (he sent screenshot-based reports through the PM); Shubham Ji's feedback.
9. A "Cancel event" option for organisers (keeps the card with a "cancelled" banner and the registrations; needs a database change). Offered 2026-10-19, not decided.
10. Before the first real batch: clear the sample data (all `@example.com` people, seeded batches, leads, events) in both organisations; decide whether Org B stays; get the lead consent wording (PDPL) approved.
11. Infrastructure: Supabase Pro (about 25 USD a month; free plan pauses after 7 idle days, a daily keep-alive job covers that), move the database closer to Dubai, optional staging project, auth settings (Google only, exact redirect list, admin MFA), point-in-time recovery.
12. Known UX gaps: the reminder text is one language (as the admin types it); Google-only sign-in; long teacher roster with no Quiet filter; admin home does a lot; long lead form; short onboarding for staff; a short page leaves a gap above the footer.
13. Possible later work: automatic invites by email or WhatsApp (needs a provider and approved consent text), a data layer such as TanStack Query, splitting AdminHome further.

## 9. WhatsApp updates to Shubham Ji

- Sent 2026-10-18: everything up to Phase 17.
- Sent 2026-10-19: automatic updates, daily reminders (it says they already work; they do not yet), new icon.
- Drafted 2026-10-19, sending not confirmed: the follow-up below.
- After reminders work: "🔔 Daily reminders are now on. Please try *Profile → Daily reminders → Turn on reminders* and tell me how the timing and the message feel 🙏"

```
🙏 Jai Gurudev Shubham Ji

A quick follow-up with a few more updates to the Sadhana app:

*1. 🔔 Reminders: one small correction*
• The daily reminders are still being switched on. I'll let you know as soon as they are ready, in the next day or two.
• Until then, Profile shows "not switched on yet". Nothing is wrong with your phone.

*2. 📱 Stays signed in on iPhone*
• If you use the app from the Home Screen icon, please *sign in once more* there.
• After that it stays signed in, even after closing the app.

*3. 🌼 Calmer practice screen*
• Softer yellow for Morning and soft purple for Evening, with a clear tick and "Done".
• "This week" and "So far: x of 40 days" are now shown separately, so the numbers are easier to read.

*4. 📅 Batch dates*
• Every batch now shows its *start and end date*. Lotus: *14 Oct – 22 Nov 2026*.
• You can change the end date when you edit a batch.

*5. 🗓️ Clearer Events page*
• Places left and the Register button sit side by side.
• If someone cancels their place, it now says "You cancelled your place" with "Register again".
• All times show *Dubai time*.

*6. 🔒 Profile and privacy*
• Profile now explains clearly what the app keeps, who can see it, and how to delete it.

The batches and names are still *sample data* for testing.

One small question: how many days is the *Art of Silence* programme? I'll set it so those batches show the right end date.

Thank you for your patience 🙏
```
