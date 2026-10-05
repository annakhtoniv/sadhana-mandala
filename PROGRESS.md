# Progress Tracker: Sadhana Mandala

## Done
- Saved master brief as [SPEC.md](file:///c:/Users/annak/sadhana-mandala/SPEC.md).
- Initialized [PROGRESS.md](file:///c:/Users/annak/sadhana-mandala/PROGRESS.md).
- Initialized Git repository on `main` branch connected to remote `https://github.com/annakhtoniv/sadhana-mandala.git`.
- Configured `.gitignore` to prevent secret and artifact leaks (`.env.local`, `node_modules`, `dist`, `*.zip`).
- Created [.env.example](file:///c:/Users/annak/sadhana-mandala/.env.example) and configured [.env.local](file:///c:/Users/annak/sadhana-mandala/.env.local) with live Supabase credentials (`https://pshapxojprvgmwhdivim.supabase.co`).
- Verified Phase 0 Google sign-in and sign-out live flow.
- Added SPA routing rewrite configurations (`.htaccess` for Spaceship/Apache and `_redirects` for static hosts).
- Drafted and perfected Phase 1 database schema in [supabase/schema.sql](file:///c:/Users/annak/sadhana-mandala/supabase/schema.sql) (`organisations`, `profiles`, `role_grants`, RLS security definer helper functions, auto-provisioning trigger, backfill for existing auth users, and account deletion RPC).
- Built [src/types/database.ts](file:///c:/Users/annak/sadhana-mandala/src/types/database.ts) with strict TypeScript types for data models and roles.
- Built [src/lib/organisation.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/organisation.ts) resolving organisation via `VITE_ORG_SLUG` with fallback and structured subdomain readiness.
- Built [src/context/AuthContext.tsx](file:///c:/Users/annak/sadhana-mandala/src/context/AuthContext.tsx) managing user session, automatic profile sync, role determination, consent recording (`consent_at`), and account deletion.
- Built [src/components/ConsentModal.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/ConsentModal.tsx) enforcing mandatory first sign-in consent detailing data storage and teacher visibility.
- Built white-label [src/components/Header.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/Header.tsx) and [src/components/Footer.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/Footer.tsx) ("Powered by ZYXENAI" per `show_powered_by`, "Concept" label, zero hardcoded branding).
- Built role-based homes:
  - [src/components/StudentHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/StudentHome.tsx): today's dynamic question, Done / Not yet / Rest day buttons, streak counter, 40-day trail in rows of 7, and un-enrolled join code panel.
  - [src/components/TeacherHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/TeacherHome.tsx): "My Batches" dashboard and teacher metrics.
  - [src/components/AdminHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/AdminHome.tsx): "Users & Roles", role pre-granting form, and organisation parameters.
- Built [src/components/ProfileScreen.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/ProfileScreen.tsx) with formatted consent timestamp, role details, and account deletion with confirmation.
- Verified TypeScript compilation (`npm.cmd run build`) with zero errors and packaged updated bundle into `sadhana-mandala-build.zip`.

## Next
- Run [supabase/schema.sql](file:///c:/Users/annak/sadhana-mandala/supabase/schema.sql) in the Supabase SQL Editor.
- Upload refreshed `sadhana-mandala-build.zip` to `sadhana.zyxenai.com` on Spaceship and extract.
- Phase 1 Verification:
  - Sign in with Google at `https://sadhana.zyxenai.com`.
  - Confirm Consent screen appears on first sign-in; click "I Understand & Consent".
  - Confirm user lands on the Student Home with today's practice question and trail.
  - Test role routing: In Admin console (or role switcher), assign Teacher role or Admin role and verify landing on the corresponding home.
  - Test Profile screen to verify consent timestamp is visible and test "Delete my account" flow.
- Await PM go-ahead to begin Phase 2 (Courses, batches, invites, auto-mapping, join code and QR).

## Known Issues
- None.
