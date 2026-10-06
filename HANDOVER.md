# Project Handover: Sadhana Mandala

> **Platform:** White-label 40-day meditation companion owned by ZYXENAI  
> **Production URL:** [https://sadhana.zyxenai.com](https://sadhana.zyxenai.com)  
> **Git Repository:** [https://github.com/annakhtoniv/sadhana-mandala.git](https://github.com/annakhtoniv/sadhana-mandala.git)  
> **Supabase Project:** `https://pshapxojprvgmwhdivim.supabase.co`  
> **Date:** October 6, 2026  

---

## 1. Can You Switch to Your Office Laptop Now?

**Yes, 100%!**  
All code, database migrations, seed scripts, and configuration guidelines have been committed and pushed to GitHub (`main`). The database is entirely cloud-hosted on Supabase, and the deployment is live on Spaceship. You do **not** need this laptop anymore to continue development.

---

## 2. 5-Minute Setup on Your Office Laptop

Follow these exact steps on your office laptop:

### Step 1: Clone the Git Repository
Open your terminal (Terminal on Mac, or PowerShell / Command Prompt on Windows) and run:
```bash
git clone https://github.com/annakhtoniv/sadhana-mandala.git
cd sadhana-mandala
```

### Step 2: Create the Local Secrets File (`.env.local`)
In the root of the `sadhana-mandala` folder, create a file named `.env.local` and paste these exact lines:
```env
# Supabase Project Configuration
VITE_SUPABASE_URL=https://pshapxojprvgmwhdivim.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzaGFweG9qcHJ2Z213aGRpdmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDc0MTYsImV4cCI6MjEwNjc4MzQxNn0.-GOesOz0tkg7ZOp_Xxr1cs6ZEnD7v-DOCXshBL_c9lA

# Organisation Configuration
VITE_ORG_SLUG=sadhana-mandala
```
*(Note: `.env.local` is git-ignored and never committed, keeping your keys safe).*

### Step 3: Install Dependencies
Run:
```bash
npm install
```
*(On Windows, if PowerShell gives an execution policy error on `npm`, run `npm.cmd install`).*

### Step 4: Run Locally (Optional)
To test or develop locally on your office laptop:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 3. What Has Been Completed & Verified

| Phase | Description | Status | Highlights |
| :--- | :--- | :---: | :--- |
| **Phase 0** | Git setup, Supabase connection, Google OAuth, Spaceship hosting | ✅ Done | Deployed live to `sadhana.zyxenai.com` over HTTPS. |
| **Phase 1** | Organisations, Sign-in, Roles, Mandatory Consent, Role Routing | ✅ Done | White-label branding loaded dynamically from DB. Consent permanently remembered across refreshes. |
| **Phase 2** | Courses, Batches, Invites, Auto-mapping, Join Code & QR Code | ✅ Done | Dynamic day calculation (`Asia/Dubai` timezone), teacher batch management, live QR codes. |
| **Testing Enhancements** | Instant Role Switcher | ✅ Done | Dropdown in header (`Student \| Teacher \| Admin`) allows testing all 3 personas instantly without extra accounts. |
| **Dummy Data** | Full Seed Script ([supabase/seed_dummy_data.sql](file:///c:/Users/annak/sadhana-mandala/supabase/seed_dummy_data.sql)) | ✅ Done | Seeded 2 organisations, 3 courses, 5 batches, 30 fictional students, streaks, 5 quiet students, and daily lessons. |
| **Lessons** | Lessons Viewer ([src/components/LessonsScreen.tsx](file:///c:/Users/annak/sadhana-mandala/src/components/LessonsScreen.tsx)) | ✅ Done | Dedicated reader for published contemplation and meditation lessons. |

---

## 4. Key Testing Credentials & Codes

You don't need test passwords—sign in with your Google account on [sadhana.zyxenai.com](https://sadhana.zyxenai.com), and use the header dropdown to switch personas:

- **As Teacher**:
  - Batches available: **Autumn Awakening Cohort** (Active at Day 23 of 40), **Summer Solstice Sadhana** (Day 40 Finished), **New Moon Mindfulness** (Day 2), **October Sadhana Cohort** (Day 1).
  - Open **Autumn Awakening Cohort** to view 30 enrolled students, pending invites, join code (`AUTUMN23`), and live QR code.
- **As Student**:
  - Your account is automatically enrolled into **Autumn Awakening Cohort** (Day 23) with a 22-day streak.
  - View the 40-day practice trail in rows of 7 and test answering the daily question (*Done / Not yet / Rest day*).
- **As Admin**:
  - View the full course catalog and all cohorts across the organization.

---

## 5. Deployment Options on Office Laptop

1. **Automatic via GitHub Actions**:
   - Whenever you `git push origin main`, GitHub Actions automatically builds and deploys directly to Spaceship via FTP using the configured secrets (`FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_SERVER_DIR`).
2. **Manual Upload Fallback**:
   - Run `npm run build` (or `npm.cmd run build`), zip the `dist` folder into `sadhana-mandala-build.zip`, and extract it in Spaceship File Manager (`public_html`).

---

## 6. What's Next (Phase 3)

When you resume on your office laptop, instruct the assistant:
> *"Proceed to Phase 3: Student check-in, streak and trail logic, with unit tests."*

In Phase 3 we will:
1. Wire the 3 check-in buttons (*Done / Not yet / Rest day*) directly into the Supabase `checkins` table with duplicate prevention.
2. Implement exact streak calculation logic (rest days preserve streak; missed days break streak).
3. Write automated unit tests verifying day number, streak calculation, and the 4-day quiet detection logic.
