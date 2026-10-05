# Progress Tracker: Sadhana Mandala

## Done
- Saved master brief as [SPEC.md](file:///c:/Users/annak/sadhana-mandala/SPEC.md).
- Initialized [PROGRESS.md](file:///c:/Users/annak/sadhana-mandala/PROGRESS.md).
- Initialized Git repository on `main` branch connected to remote `https://github.com/annakhtoniv/sadhana-mandala.git`.
- Configured `.gitignore` to prevent secret and artifact leaks (`.env.local`, `node_modules`, `dist`, `*.zip`).
- Created [.env.example](file:///c:/Users/annak/sadhana-mandala/.env.example) and configured [.env.local](file:///c:/Users/annak/sadhana-mandala/.env.local) with live Supabase credentials (`https://pshapxojprvgmwhdivim.supabase.co`).
- Verified Phase 0 Google sign-in and sign-out live flow.
- Added SPA routing rewrite configurations (`.htaccess` for Spaceship/Apache and `_redirects` for static hosts).
- Configured automated GitHub Actions deployment pipeline ([.github/workflows/deploy.yml](file:///c:/Users/annak/sadhana-mandala/.github/workflows/deploy.yml)) to build and deploy straight to Spaceship on every `git push`.
- Configured GitHub Repository Secrets for automated FTP deployment (`FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, and `FTP_SERVER_DIR`).
- Completed Phase 1: White-label theming, mandatory consent modal storing `consent_at`, role routing, profile screen with account deletion, and resolved re-render loop.
- Completed Phase 2:
  - Drafted [supabase/schema_phase2.sql](file:///c:/Users/annak/sadhana-mandala/supabase/schema_phase2.sql) with tables `courses`, `batches`, `batch_invites`, `enrolments`, RLS policies, and RPC functions (`claim_pending_invites`, `join_batch_by_code`, `add_batch_invites`).
  - Added timezone-aware date utilities in [src/lib/dateUtils.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/dateUtils.ts) calculating batch day numbers from `start_date` in the organisation timezone.
  - Built [src/lib/batchService.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/batchService.ts) for courses, batches, invites, enrolments, and auto-mapping.
  - Updated [src/context/AuthContext.tsx](file:///c:/Users/annak/sadhana-mandala/src/context/AuthContext.tsx) to automatically claim pending invites on sign-in and manage enrolment state.
  - Enhanced [src/components/StudentHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/StudentHome.tsx) with un-enrolled join code panel and active enrolled view (day number, question, and dynamic `duration_days` practice trail).
  - Built [src/components/TeacherBatchDetail.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/TeacherBatchDetail.tsx) with join code display, live QR code (`qrcode.react`), email pasting with auto-mapping, and student roster.
  - Enhanced [src/components/TeacherHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/TeacherHome.tsx) with "My Batches" dashboard and batch creation modal.
  - Enhanced [src/components/AdminHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/AdminHome.tsx) with Course Catalog management and All Batches overview.
  - Fixed consent prompt repetition across page reloads by pairing database sync with local persistent storage.
  - Enabled active role switcher dropdown (`Role: Student | Role: Teacher | Role: Admin`) directly in the header to effortlessly test all 3 personas without creating extra email accounts.
  - Created [supabase/fix_consent_and_roles.sql](file:///c:/Users/annak/sadhana-mandala/supabase/fix_consent_and_roles.sql) to promote user to Admin and generate simulated Teacher and Admin profiles.
  - Verified clean TypeScript compilation (`npm.cmd run build`) with zero errors and packaged updated bundle into `sadhana-mandala-build.zip`.

## Next
- Run [supabase/schema_phase2.sql](file:///c:/Users/annak/sadhana-mandala/supabase/schema_phase2.sql) and [supabase/fix_consent_and_roles.sql](file:///c:/Users/annak/sadhana-mandala/supabase/fix_consent_and_roles.sql) in the Supabase SQL Editor.
- Phase 2 Verification:
  - Select "Role: Teacher" to create a batch and view the unique join code and QR code.
  - Paste student emails to test auto-mapping.
  - Select "Role: Student" to test joining by code and view the 40-day practice trail.
- Await PM go-ahead to begin Phase 3 (Student check-in, streak and trail logic, with unit tests).

## Known Issues
- None.
