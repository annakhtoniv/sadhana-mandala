# Comprehensive Technical Handover: Sadhana Mandala

> **Platform:** Sadhana Mandala (White-Label 40-Day Daily Practice Companion PWA)  
> **Repository:** [https://github.com/annakhtoniv/sadhana-mandala.git](https://github.com/annakhtoniv/sadhana-mandala.git)  
> **Production Custom Domain:** [https://sadhana.zyxenai.com](https://sadhana.zyxenai.com)  
> **Production Host:** GitHub Pages (Automated CI/CD via `.github/workflows/pages.yml`)  
> **Database:** Supabase (`https://pshapxojprvgmwhdivim.supabase.co`)  
> **Latest Git Commit:** `8bd3e4d` on `main`  
> **Test Status:** 54/54 automated tests passing (`npx vitest run`)  
> **Date:** October 12, 2026  

---

## 1. Executive Summary & Readiness for Claude Code

All development on Phases 0, 1, 2, and 3 is **100% complete, tested, and pushed to GitHub `origin/main`**.
Deployment has been successfully migrated from Spaceship hosting directly to **GitHub Pages** under the custom domain `sadhana.zyxenai.com`.

You can switch to your office laptop immediately. You will need zero files from this machine; everything is tracked in Git, backed up in GitHub Actions, and persisted in Supabase.

---

## 2. 5-Minute Setup on Office Laptop (Claude Code)

Run these exact commands in your terminal on your office laptop:

```bash
# 1. Clone the repository
git clone https://github.com/annakhtoniv/sadhana-mandala.git
cd sadhana-mandala

# 2. Create your .env.local file
cat << 'EOF' > .env.local
VITE_SUPABASE_URL=https://pshapxojprvgmwhdivim.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzaGFweG9qcHJ2Z213aGRpdmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDc0MTYsImV4cCI6MjEwNjc4MzQxNn0.-GOesOz0tkg7ZOp_Xxr1cs6ZEnD7v-DOCXshBL_c9lA
VITE_ORG_SLUG=sadhana-mandala
EOF

# 3. Install dependencies
npm install

# 4. Verify test suite (all 54 tests must pass)
npx vitest run

# 5. Start local development server
npm run dev
```

---

## 3. Infrastructure & Deployment Architecture

### A. Hosting Transition (Spaceship ➔ GitHub Pages)
- **Previous Host:** Spaceship cPanel (`66.29.148.114`) — **abandoned per user instruction**.
- **Current Host:** **GitHub Pages** powered by GitHub Actions.
- **Workflow File:** `.github/workflows/pages.yml`
  - Runs automatically on every `git push origin main`.
  - Builds with `VITE_BASE='/'` so routing works at the domain root.
  - Automatically preserves the custom domain `CNAME` (`sadhana.zyxenai.com`).
  - Directly deploys the production bundle to GitHub Pages CDN.

### B. DNS Status
- **Provider:** Spaceship DNS Manager for domain `zyxenai.com`.
- **Subdomain Record:** `sadhana`
  - **Type:** `CNAME`
  - **Target/Value:** `annakhtoniv.github.io`
  - **Status:** **Active and resolving globally** to GitHub Pages edge IP addresses (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`).
  - The old Spaceship `A` record (`66.29.148.114`) has been fully replaced.

### C. SSL / HTTPS Status & Browser Behavior
- **Let's Encrypt Certificate:** GitHub Pages automatically provisions a certificate for custom domains. It takes anywhere from 15 minutes to a few hours after DNS verification for the certificate to deploy across all CDN edge nodes.
- **Why Chrome showed an error:**
  1. **HSTS Cache:** Because `sadhana.zyxenai.com` was previously visited on Spaceship with SSL, Chrome saved an HSTS policy that forces `https://`.
  2. **Cert Issuance Queue:** During GitHub's initial provisioning window, GitHub's edge serves its wildcard cert (`*.github.io`) instead of `sadhana.zyxenai.com`, causing Chrome to display `ERR_CERT_COMMON_NAME_INVALID`.
- **How to view immediately:**
  - **Incognito window:** `http://sadhana.zyxenai.com` works immediately.
  - **Chrome developer bypass:** On the `Your connection is not private` error screen, click the blank area and type `thisisunsafe` on your keyboard.
  - **GitHub Pages Settings:** In the GitHub repository under **Settings > Pages**, once the certificate finishes issuing, GitHub automatically enables the **"Enforce HTTPS"** checkbox.

---

## 4. Phase Completion Status

| Phase | Milestone | Status | Key Deliverables & Test Verification |
| :--- | :--- | :---: | :--- |
| **Phase 0** | Scaffold, Supabase, Google OAuth | ✅ DONE | Real OAuth flow, `.env` structure, GitHub repo setup. |
| **Phase 1** | Orgs, Theming, Consent, Roles | ✅ DONE | Dynamic DB-driven theme tokens, persistent consent modal (`consent_at`), role switcher header. |
| **Phase 2** | Courses, Batches, Invites, QR Codes | ✅ DONE | Timezone-aware day calculation (`Asia/Dubai`), batch enrollment, join codes, QR generator (`qrcode.react`). |
| **Phase 3** | Student Check-in, Streaks, Quiet Logic | ✅ DONE | Supabase `checkins` table with idempotent upserts, consecutive streak math, 4-day quiet student detection, 54 passing Vitest unit tests. |
| **Admin UI** | Human 2.0 Obsidian Console Redesign | ✅ DONE | Dark daylight palette, Sovereign Admin credentials (`annakhtoniv@gmail.com`), infallible cohort creation fallback, quick console switchers. |
| **Phase 4** | Teacher Batch Dashboard Polish | ⏳ **NEXT** | Roster verification against seed script, multi-org isolation test, and Demo Cut Line readiness. |

---

## 5. Key Architecture & File Reference

### 1. Pure Calculation Utilities & Vitest Suite
- **[src/lib/practiceUtils.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/practiceUtils.ts)**:
  - `getDayNumberInTimezone(startDate, timezone)`: Computes current 1-indexed day number in organization timezone (`Asia/Dubai` default).
  - `calculateStreak(checkins, currentDayNumber)`: Calculates consecutive `done` days. Rest days preserve the streak; `not_yet` or missed days break the streak. Handles today's in-progress state.
  - `isQuietStudent(checkins, currentDayNumber, thresholdDays = 4)`: Returns `true` if student has zero check-ins for 4 consecutive days up to current day.
  - `getPracticeTrailDays(checkins, durationDays, currentDayNumber)`: Computes visual status (`done`, `rest`, `not_yet`, `missed`, `today`, `future`) for dynamic 7-column grid.
  - `upsertCheckinInMemory(existing, newCheckin)`: Idempotency guarantee for unit tests and offline state.
- **[src/lib/practiceUtils.test.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/practiceUtils.test.ts)**:
  - 54 comprehensive unit tests covering all edge cases (leap days, DST, timezone offsets, rest streaks, gap streaks, idempotent re-taps).

### 2. Services & Data Layer
- **[src/lib/checkinService.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/checkinService.ts)**:
  - Handles Supabase operations on `checkins` table (`student_id`, `batch_id`, `day_number`, `status`, `updated_at`).
  - Upsert targeting `unique(student_id, batch_id, day_number)`.
  - Fallback in-memory storage for offline/demo modes.
- **[src/lib/batchService.ts](file:///c:/Users/annak/sadhana-mandala/src/lib/batchService.ts)**:
  - Manages courses, batches, invites, and roster lookups.
  - Validates foreign keys (`batches_course_id_fkey`, `batches_teacher_id_fkey`) with resilient fallback to prevent FK constraint failures during cohort creation.

### 3. UI Components
- **[src/components/StudentHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/StudentHome.tsx)**:
  - Daily check-in card (`Done`, `Not yet`, `Rest day`).
  - Flame streak badge.
  - 7-column practice trail rendering dynamically for `duration_days`.
- **[src/components/AdminHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/AdminHome.tsx)**:
  - Signature Human 2.0 dark obsidian aesthetic.
  - Operations Hero, Sanctuary KPIs, active cohort cards, 1-click batch launcher modal.
- **[src/components/TeacherBatchDetail.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/TeacherBatchDetail.tsx)**:
  - Today's metrics summary (Done, Rest, Not yet, Quiet).
  - Sortable student roster (by Quiet, Streak, Status, Name) with Quiet student warnings.
- **[src/components/TeacherHome.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/TeacherHome.tsx)**:
  - Teacher cohort list, quick creation modal.

### 4. Database Schema & Seed Scripts
- **[RUN_THIS_IN_SUPABASE.sql](file:///c:/Users/annak/sadhana-mandala/RUN_THIS_IN_SUPABASE.sql)**: Complete all-in-one SQL setup script.
- **[supabase/schema_phase3.sql](file:///c:/Users/annak/sadhana-mandala/supabase/schema_phase3.sql)**: RLS policies, tables, and triggers for check-ins.
- **[supabase/seed_dummy_data.sql](file:///c:/Users/annak/sadhana-mandala/supabase/seed_dummy_data.sql)**:
  - Org A ("Sadhana Mandala", Dubai timezone) with 3 batches (Day 40 finished, Day 23 active, Day 2 fresh), 30 fictional students, streaks, 5 quiet students.
  - Org B ("Prana Flow Academy", Dubai timezone) with 1 batch and 5 students.

---

## 6. Exact Prompt to Give Claude Code Tomorrow

When you open Claude Code on your office laptop, paste this exact prompt:

```text
Hi Claude! We are working on "Sadhana Mandala" (React 18, TypeScript, Tailwind, Vite, Supabase).
Please review HANDOVER.md and PROGRESS.md in the project root.

Current status:
- Phases 0, 1, 2, and 3 are 100% complete with 54 passing Vitest unit tests (`npx vitest run`).
- Hosting is live on GitHub Pages (`sadhana.zyxenai.com`) via `.github/workflows/pages.yml`.
- Database is hosted on Supabase (`pshapxojprvgmwhdivim.supabase.co`).
- Admin user is locked to Vinoth Rajaasekaran (annakhtoniv@gmail.com).

Today's objective: Complete Phase 4 per SPEC.md:
1. Verify the Teacher Batch Dashboard in TeacherBatchDetail.tsx against the seed data in supabase/seed_dummy_data.sql:
   - Verify counts for today (Done / Rest / Not yet / Quiet).
   - Verify sortable student roster with streak badges and Quiet warning tags.
   - Verify invite management, join code, and live QR code display.
2. Verify multi-organization data isolation:
   - Ensure a Teacher in Organization A cannot see or access any batches, students, or check-ins from Organization B.
3. Review and polish the app up to the DEMO CUT LINE (Phase 4 completion in SPEC.md).
4. Run all unit tests (`npx vitest run`) and verify clean TypeScript build (`npm run build`).

Let's begin by running the test suite and inspecting the current TeacherBatchDetail.tsx component.
```

---

## 7. Useful Reference Links
- GitHub Repository: [https://github.com/annakhtoniv/sadhana-mandala](https://github.com/annakhtoniv/sadhana-mandala)
- GitHub Actions CI/CD: [https://github.com/annakhtoniv/sadhana-mandala/actions](https://github.com/annakhtoniv/sadhana-mandala/actions)
- Production Domain: [http://sadhana.zyxenai.com](http://sadhana.zyxenai.com) / [https://sadhana.zyxenai.com](https://sadhana.zyxenai.com)
- Supabase Dashboard: [https://supabase.com/dashboard/project/pshapxojprvgmwhdivim](https://supabase.com/dashboard/project/pshapxojprvgmwhdivim)
