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
  - Verified production build and updated `sadhana-mandala-build.zip`.

## Next
- Execute the updated [supabase/seed_dummy_data.sql](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/supabase/seed_dummy_data.sql) in Supabase SQL Editor.
- Verify 1-click batch join (`AUTUMN23`) and interactive guided tour on [http://localhost:5173](http://localhost:5173).
- Proceed to Phase 4 (Teacher batch dashboard polish & seed script verification).

## Known Issues
- None.
