# Progress Tracker: Sadhana Mandala

## Done
- Saved master brief as [SPEC.md](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/SPEC.md).
- Initialized [PROGRESS.md](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/PROGRESS.md).
- Initialized Git repository on `main` branch connected to remote `https://github.com/annakhtoniv/sadhana-mandala.git`.
- Configured `.gitignore` to prevent any secret or artifact leaks (`.env.local`, `node_modules`, `dist`, `*.zip`).
- Created [.env.example](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/.env.example) and populated [.env.local](file:///c:/Users/ven-vinothr/Downloads/Sadhana%20Mandala/.env.local) with live Supabase credentials (`https://pshapxojprvgmwhdivim.supabase.co`).
- Scaffolded mobile-first web app with React 18, Vite, TypeScript, Tailwind CSS, and PWA manifest.
- Built Phase 0 page component with connection status, Google sign-in trigger, concept label, and "Powered by ZYXENAI" footer.
- Added SPA routing rewrite configurations (`.htaccess` for Spaceship/Apache and `_redirects` for static hosts).
- Tested local server (`npm run dev`) and verified production build output (`npm run build`).
- Created automated packaging command (`npm run package`) producing updated `sadhana-mandala-build.zip` with live credentials.

## Next
- Complete Google Cloud OAuth and Supabase Auth configuration:
  - Add Google Client ID and Secret to Supabase Auth -> Providers -> Google.
  - Set Supabase callback URL in Google Cloud Console (`https://pshapxojprvgmwhdivim.supabase.co/auth/v1/callback`).
  - Set Supabase Site URL / Redirect URLs to include `http://localhost:5173` and `https://sadhana.zyxenai.com`.
- Deploy to `sadhana.zyxenai.com` on Spaceship.com:
  - Upload `sadhana-mandala-build.zip` to subdomain document root and extract.
- Phase 0 Verification: Confirm page loads over HTTPS at `https://sadhana.zyxenai.com` and Google sign-in works.
- Proceed to Phase 1 upon PM go-ahead.

## Known Issues
- None.
