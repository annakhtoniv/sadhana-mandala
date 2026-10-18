import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Sends errors people run into to the database (table client_errors, read by
 * admins), so problems are noticed without anyone having to report them.
 * At most a few per page visit; the database also limits each person to 20 an hour.
 */
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const MAX_PER_VISIT = 5;
let sent = 0;
const seen = new Set<string>();

export function reportError(error: unknown, detail?: string): void {
  try {
    if (!isSupabaseConfigured || sent >= MAX_PER_VISIT) return;
    const message = error instanceof Error ? error.message : String(error);
    // Network hiccups are not bugs
    if (/Failed to fetch|NetworkError|Load failed|AbortError/i.test(message)) return;
    const key = message.slice(0, 120);
    if (seen.has(key)) return;
    seen.add(key);
    sent += 1;
    const stack = error instanceof Error && error.stack ? error.stack : '';
    void supabase
      .rpc('log_client_error', {
        p_message: message.slice(0, 500),
        p_detail: [detail, stack].filter(Boolean).join('\n').slice(0, 4000) || null,
        p_page: window.location.pathname,
        p_app_version: APP_VERSION,
      })
      .then(() => undefined, () => undefined);
  } catch {
    // reporting must never break the app
  }
}

/** Catches errors that no screen handled. */
export function installGlobalErrorReporting(): void {
  window.addEventListener('error', (e) => reportError(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
}
