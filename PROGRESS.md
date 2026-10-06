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
  - Completed Phase 2 & Seed Data Provisioning:
  - Created [supabase/seed_dummy_data.sql](file:///c:/Users/annak/sadhana-mandala/supabase/seed_dummy_data.sql) seeding complete dummy data for everything:
    - Organisation A ("Sadhana Mandala", dark stone + emerald theme, Dubai timezone, Powered by ZYXENAI)
    - Organisation B ("Prana Flow Academy", slate + amber theme, Dubai timezone, show_powered_by false)
    - Courses (40-Day Sadhana, 21-Day Mindfulness Starter, Prana Foundation 30)
    - Teachers & Admins (Ananda Sharma, Priya Patel, Sadhana Admin, Marcus Vance, Prana Admin)
    - Batches in Org A: Day 40 Finished ("Summer Solstice"), Day 23 Active ("Autumn Awakening"), Day 2 Fresh ("New Moon"), Day 1 ("October Sadhana")
    - Batches in Org B: Day 10 Active ("Prana Sunrise")
    - 30 clearly fictional students in Org A and 5 students in Org B with full profiles and consent
    - Complete check-ins with streaks, rest days, and 5 demonstrable QUIET students (Days 19-23 silent)
    - Real published meditation and daily wisdom lessons (General, Course, and Batch daily scope)
  - Created [src/components/LessonsScreen.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/LessonsScreen.tsx) and updated [src/types/database.ts](file:///c:/Users/annak/sadhana-mandala/src/types/database.ts) to display published lessons.
  - Auto-enrolled logged-in user into the Day 23 cohort with full check-in streak so Student, Teacher, and Admin personas immediately display rich data.
  - Created [HANDOVER.md](file:///c:/Users/annak/sadhana-mandala/HANDOVER.md) with complete office laptop transition and project handover instructions.

## Next
- Run [supabase/seed_dummy_data.sql](file:///c:/Users/annak/sadhana-mandala/supabase/seed_dummy_data.sql) in the Supabase SQL Editor.
- Verify Student, Teacher, and Admin views with rich dummy data.
- Await PM approval to start Phase 3 (Student check-in, streak and trail logic, with unit tests).

## Known Issues
- None.
