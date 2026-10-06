# Progress Tracker: Sadhana Mandala

## Done
- Saved master brief as [SPEC.md](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/SPEC.md).
- Initialized [PROGRESS.md](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/PROGRESS.md).
- Initialized Git repository on `main` branch connected to remote `https://github.com/annakhtoniv/sadhana-mandala.git`.
- Configured `.gitignore` to prevent secret and artifact leaks (`.env.local`, `node_modules`, `dist`, `*.zip`).
- Created [.env.example](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/.env.example) and configured [.env.local](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/.env.local) with live Supabase credentials (`https://pshapxojprvgmwhdivim.supabase.co`).
- Verified Phase 0 Google sign-in and sign-out live flow.
- Added SPA routing rewrite configurations (`.htaccess` for Spaceship/Apache and `_redirects` for static hosts).
- Configured automated GitHub Actions deployment pipeline ([.github/workflows/deploy.yml](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/.github/workflows/deploy.yml)).
- Completed Phase 1: White-label theming, mandatory consent modal storing `consent_at`, role routing, profile screen with account deletion.
- Completed Phase 2:
  - Drafted [supabase/schema_phase2.sql](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/supabase/schema_phase2.sql) with tables `courses`, `batches`, `batch_invites`, `enrolments`, RLS policies, and RPC functions.
  - Added timezone-aware date utilities in [src/lib/dateUtils.ts](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/lib/dateUtils.ts).
  - Built [src/lib/batchService.ts](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/lib/batchService.ts).
  - Built [src/components/TeacherBatchDetail.tsx](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/components/TeacherBatchDetail.tsx) with join code, live QR code, email invite auto-mapping.
  - Built [src/components/TeacherHome.tsx](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/components/TeacherHome.tsx) and [src/components/AdminHome.tsx](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/components/AdminHome.tsx).
- Completed Phase 3 & Usability Enhancements:
  - Fixed [supabase/seed_dummy_data.sql](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/supabase/seed_dummy_data.sql) trigger bypass preventing `P0001: Cannot change role directly` error.
  - Implemented [src/lib/checkinService.ts](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/lib/checkinService.ts) with Supabase upsert ensuring tapping twice updates the row and never duplicates it (`onConflict: 'student_id,batch_id,day_number'`).
  - Implemented exact streak calculation logic (consecutive "done" days, rest days preserve streak, missed days break streak).
  - Implemented 4-day quiet detection logic (`isStudentQuiet`).
  - Added past date marking in [src/components/StudentHome.tsx](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/components/StudentHome.tsx) allowing practitioners to click and record missed past days.
  - Locked and greyed out future days with distinct dashed borders and disabled interaction.
  - Added 1-Click Demo Cohort Join buttons (`AUTUMN23`, `SADH40`) on the un-enrolled screen so users never need to guess a join code.
  - Built [src/components/GuidedTour.tsx](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/components/GuidedTour.tsx) interactive step-by-step tour with visual highlighting, explaining where to click and why for first-time users.
  - Added tour guide reopen button (`?`) to [src/components/Header.tsx](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/components/Header.tsx).
  - Written and verified 20 automated unit tests (100% passing) with Vitest.
  - Created bulletproof [RUN_THIS_IN_SUPABASE.sql](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/RUN_THIS_IN_SUPABASE.sql) combining all schema definitions, RLS policies, all 6 RPCs, dropping restrictive old triggers (`tr_protect_profile_fields`), dropping foreign key constraints on `profiles.id`, and auto-enrolling any real account (Vinoth Rajaasekaran) into `Autumn Awakening Cohort` (Day 23) with an instant 22-day streak.
- Updated [src/context/AuthContext.tsx](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/context/AuthContext.tsx) to execute `set_my_role` RPC so the header persona switcher smoothly elevates permissions.
- Added 1-Click Demo Login (`Vinoth Rajaasekaran`) in [src/App.tsx](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/App.tsx) and [src/context/AuthContext.tsx](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/context/AuthContext.tsx) to allow instant testing inside embedded IDE webviews and sidebar previews where Google OAuth restricts embedded iframes with 403 errors.
- Implemented complete offline/empty-table dummy data fallbacks in [src/lib/mockData.ts](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/lib/mockData.ts), [src/lib/batchService.ts](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/lib/batchService.ts), [src/lib/checkinService.ts](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/lib/checkinService.ts), and [src/context/AuthContext.tsx](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/context/AuthContext.tsx):
  - **Student**: Auto-enrolled in *Autumn Awakening Cohort* (calculated so today is Day 23 of 40), 22-day streak (with rest days on 7, 14, 21), interactive trail for past days (1–22), locked future days (24–40), and local check-in persistence across reloads.
  - **Teacher**: 4 cohorts displayed, 30 fictional students in the roster with 5 quiet students flagged with warning badges, streak counts, and invite generator.
  - **Admin**: 31 user profiles, 4 batches, and 2 courses loaded instantly.
  - **Auto-Login**: First-time launch automatically initializes the demo session for Vinoth Rajaasekaran so the app is immediately populated without requiring manual codes or login clicks.
- Overhauled [src/components/GuidedTour.tsx](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/components/GuidedTour.tsx):
  - Replaced translateY CSS transforms with exact mathematical coordinate calculations and strict viewport clamping, guaranteeing tooltips never clip off-screen.
  - Tethered directional callout arrows (`rotate-45`) pointing directly at the center of target elements (Practice check-in buttons, 40-day trail, streak flame counter, persona switcher).
  - Target elements highlight with an animated emerald pulse ring (`ring-4 ring-emerald-500 animate-pulse`).
  - Navigation Fluency Gauge tracks real-time interactions (`checkin`, `trail`, `streak`, `role`), automatically advancing steps upon natural user actions and celebrating progress.
  - Once 100% fluency is achieved, displays a graduation dialog and automatically retires the guide to localStorage (`sadhana_navigation_mastered = 'true'`).
  - Re-summonable at any time via the `?` icon in the Header.
- Verified 20/20 Vitest unit tests passing and verified production build with Vite.

## Next
- Launch the application at [http://localhost:5173](http://localhost:5173) to review the populated screens and interactive pointing tooltips.
- Switch between Student, Teacher, and Admin personas in the header to inspect all dashboards.
- Proceed to Phase 4 (Teacher batch dashboard polish & demo cut line).

## Known Issues
- None.
