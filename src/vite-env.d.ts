/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_ORG_SLUG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Build date, set in vite.config.ts (sent with error reports) */
declare const __APP_VERSION__: string;
