# Progress Tracker: Sadhana Mandala

## Done
- Saved master brief as [SPEC.md](file:///c:/Users/annak/sadhana-mandala/SPEC.md).
- Initialized [PROGRESS.md](file:///c:/Users/annak/sadhana-mandala/PROGRESS.md).
- Initialized Git repository on `main` branch connected to remote `https://github.com/annakhtoniv/sadhana-mandala.git`.
- Configured `.gitignore` to prevent any secret or artifact leaks (`.env.local`, `node_modules`, `dist`, `*.zip`).
- Created [.env.example](file:///c:/Users/annak/sadhana-mandala/.env.example) and configured [.env.local](file:///c:/Users/annak/sadhana-mandala/.env.local) with live Supabase credentials (`https://pshapxojprvgmwhdivim.supabase.co`).
- Cleaned up untracked temporary `.env.local.txt` and verified `.env.local` URL syntax.
- Scaffolded mobile-first web app with React 18, Vite, TypeScript, Tailwind CSS, and PWA manifest.
- Built Phase 0 page component with connection status, Google sign-in trigger, concept label, and "Powered by ZYXENAI" footer.
- Added SPA routing rewrite configurations (`.htaccess` for Spaceship/Apache and `_redirects` for static hosts).
- Tested local server (`npm run dev`) and verified production build output (`npm.cmd run build`).
- Created automated packaging command (`npm run package`) and refreshed `sadhana-mandala-build.zip` with live credentials.
- Drafted Phase 1 database schema and migrations in [supabase/schema.sql](file:///c:/Users/annak/sadhana-mandala/supabase/schema.sql) (`organisations`, `profiles`, `role_grants`, RLS security definer helper functions, auto-provisioning trigger, and account deletion RPC).

## Next
- Complete Google Cloud OAuth and Supabase Auth configuration:
  - Add Google Client ID and Secret to Supabase Auth -> Providers -> Google.
  - Set Supabase callback URL in Google Cloud Console (`https://pshapxojprvgmwhdivim.supabase.co/auth/v1/callback`).
  - Configure Google OAuth Consent Screen Test Users (for demo sign-ins).
  - Set Supabase Site URL / Redirect URLs to include `http://localhost:5173` and `https://sadhana.zyxenai.com`.
- Deploy to `sadhana.zyxenai.com` on Spaceship.com:
  - Upload `sadhana-mandala-build.zip` to subdomain document root and extract.
- Phase 0 Verification: Confirm page loads over HTTPS at `https://sadhana.zyxenai.com` and Google sign-in works.
- Phase 1 Execution:
  - Run [supabase/schema.sql](file:///c:/Users/annak/sadhana-mandala/supabase/schema.sql) in the Supabase SQL Editor.
  - Implement dynamic white-label theme provider from organisation record.
  - Build Consent screen modal storing `consent_at`.
  - Implement role-based routing (Student Home, Teacher My Batches, Admin Users/Roles).
  - Add Account Deletion with confirmation.

## Known Issues
- None.
