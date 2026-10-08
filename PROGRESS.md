# Progress Tracker: Sadhana Mandala

## Done
- Saved master brief as [SPEC.md](file:///c:/Users/annak/sadhana-mandala/SPEC.md).
- Initialized [PROGRESS.md](file:///c:/Users/annak/sadhana-mandala/PROGRESS.md).
- Initialized Git repository on `main` branch connected to remote `https://github.com/annakhtoniv/sadhana-mandala.git`.
- Configured `.gitignore` to prevent secret and artifact leaks (`.env.local`, `node_modules`, `dist`, `*.zip`).
- Created [.env.example](file:///c:/Users/annak/sadhana-mandala/.env.example) and configured [.env.local](file:///c:/Users/annak/sadhana-mandala/.env.local) with live Supabase credentials (`https://pshapxojprvgmwhdivim.supabase.co`).
- Verified Phase 0 Google sign-in and sign-out live flow.
- Added SPA routing rewrite configurations (`.htaccess` for Spaceship/Apache and `_redirects` for static hosts).
- Configured automated GitHub Actions deployment pipeline ([.github/workflows/deploy.yml](file:///c:/Users/annak/sadhana-mandala/.github/workflows/deploy.yml)) and GitHub Pages workflow ([.github/workflows/pages.yml](file:///c:/Users/annak/sadhana-mandala/.github/workflows/pages.yml)).
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
  - Created [HANDOVER.md](file:///c:/Users/annak/sadhana-mandala/HANDOVER.md) with complete office laptop transition and project handover instructions.
- Completed Phase 3 & Usability Enhancements:
  - Drafted [supabase/schema_phase3.sql](file:///c:/Users/annak/sadhana-mandala/supabase/schema_phase3.sql) containing `checkins` table definition (`student_id`, `batch_id`, `day_number`, `status`, `updated_at`), indexes, automatic `updated_at` trigger, and RLS policies for students, teachers, and admins.
  - Built pure utility module [src/lib/practiceUtils.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/practiceUtils.ts) exporting:
    - Timezone-aware day number calculation (`Asia/Dubai` default, start_date = Day 1).
    - Consecutive streak calculation (consecutive 'done' days, 'rest' preserving streak without adding, 'not_yet' breaking streak, gap days breaking streak, today in-progress preserving prior streak).
    - Quiet student detection logic (no check-in of any kind for 4 consecutive days up to current day).
    - Practice trail status mapping (`done`, `rest`, `not_yet`, `missed`, `today`, `future`).
    - In-memory idempotent upsert (`upsertCheckinInMemory`) guaranteeing single row per (student, batch, day).
  - Built Supabase persistence service [src/lib/checkinService.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/checkinService.ts) supporting idempotent upsert targeting `unique(student_id, batch_id, day_number)` and seamless fallback demo data.
  - Enhanced [src/components/StudentHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/StudentHome.tsx) with:
    - Daily check-in options ('done', 'not_yet', 'rest') saving to and loading from Supabase `checkins` table.
    - Idempotent updates (tapping twice or changing answer updates today's row, never duplicates it).
    - Live streak calculation with flame icon badge.
    - Dynamic 7-column practice trail rendering for `duration_days` visually representing 'done', 'rest', 'not_yet', and 'missed' statuses with locked/greyed out future days.
    - Past date marking and viewing.
    - 1-Click Demo Cohort Join buttons (`AUTUMN23`, `SADH40`) on the un-enrolled screen.
  - Enhanced [src/components/TeacherBatchDetail.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/TeacherBatchDetail.tsx) with today's metrics summary (Done, Rest, Not yet, Quiet) and sortable student roster (by Quiet, Streak, Status, Name) with Quiet student warnings.
  - Built [src/components/GuidedTour.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/GuidedTour.tsx) interactive tour with mathematical coordinate clamping, directional arrows, and real-time Navigation Fluency Gauge.
  - Added 1-Click Demo Login (`Vinoth Rajaasekaran`) in [src/App.tsx](file:///c:/Users/annak/sadhana-mandala/src/App.tsx) for instant preview in embedded IDE webviews.
  - Created [RUN_THIS_IN_SUPABASE.sql](file:///c:/Users/annak/sadhana-mandala/RUN_THIS_IN_SUPABASE.sql) all-in-one SQL setup script.
  - Installed Vitest test runner and authored automated unit tests in [src/lib/__tests__/practiceUtils.test.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/__tests__/practiceUtils.test.ts), [src/lib/__tests__/checkinService.test.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/__tests__/checkinService.test.ts), [src/lib/checkinService.test.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/checkinService.test.ts), and [src/lib/dateUtils.test.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/dateUtils.test.ts). Verified 100% tests passing with zero failures.
  - Verified `npm.cmd run build` with zero TypeScript errors.
  - Updated `sadhana-mandala-build.zip` archive for deployment.

## Next
- Switch between Student, Teacher, and Admin personas to inspect all dashboards.
- Proceed to Phase 4 (Teacher batch dashboard polish & demo cut line).
- Await PM review and approval.

## Known Issues
- None.
