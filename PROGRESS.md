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
- Completed Phase 3:
  - Fixed [supabase/seed_dummy_data.sql](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/supabase/seed_dummy_data.sql) and [supabase/schema.sql](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/supabase/schema.sql) trigger `protect_profile_fields()` to bypass restrictions when running as migration / SQL editor scripts, eliminating the `Cannot change role directly` error.
  - Implemented [src/lib/checkinService.ts](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/lib/checkinService.ts) with Supabase upsert ensuring tapping twice updates the row and never duplicates it (`onConflict: 'student_id,batch_id,day_number'`).
  - Implemented exact mathematical streak logic (consecutive "done" days, rest days preserve streak, missed days break streak).
  - Implemented 4-day quiet detection logic (`isStudentQuiet`).
  - Enhanced [src/components/StudentHome.tsx](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/components/StudentHome.tsx):
    - Wired *Done / Not yet / Rest day* directly into Supabase with live feedback and optimistic UI updates.
    - Added past date selection: students can tap any past day in the trail to record or edit their answers.
    - Future days are visible but locked/greyed out with distinct dashed styling and disabled interaction.
  - Enhanced [src/components/TeacherBatchDetail.tsx](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/components/TeacherBatchDetail.tsx):
    - Added today's check-in summary cards (Done, Rest, Not Yet, Quiet).
    - Added student roster with live streak count, today's status, last answer day, and red `Quiet` flag.
    - Added sortable roster (by Quiet first, Streak, Name, Status).
  - Configured Vitest and wrote automated unit tests in [src/lib/dateUtils.test.ts](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/lib/dateUtils.test.ts) and [src/lib/checkinService.test.ts](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/src/lib/checkinService.test.ts) (20 tests passed, 100% green).
  - Verified production build (`npm run build`) and generated fresh `sadhana-mandala-build.zip`.

## Next
- Have the Project Manager run the updated [supabase/seed_dummy_data.sql](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/supabase/seed_dummy_data.sql) in the Supabase SQL Editor.
- Verify Phase 3 test cases (tapping twice, past day marking, future day lock, streak, quiet flag).
- Await PM approval to proceed to Phase 4 (Teacher batch dashboard polish & demo cut line).

## Known Issues
- None.
