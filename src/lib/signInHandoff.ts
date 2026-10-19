/**
 * Staying signed in on the iPhone Home Screen app (Phase 19).
 *
 * On iPhone, Google sign-in from a Home Screen app opens in a small Safari
 * window, and the page Google returns to also opens in that window. The app
 * itself never got the sign-in, so it looked signed out the next time.
 *
 * Sign-in now uses a one-time code that only works together with a secret key
 * the app keeps (PKCE). When the code arrives in the Safari window instead of
 * the app, the window leaves it in the database under a random hand-over id
 * (supabase/phase19_signin_handoff.sql) and asks the person to go back. The
 * app picks it up once, with the secret key, and is signed in.
 */
import { supabase } from './supabase';
import { isStandalone } from './installPrompt';
import { isAuthCode } from './joinLink';

const HANDOFF_KEY = 'sadhana_signin_handoff';
/** Same limit as the database: an older hand-over is gone. */
export const HANDOFF_MAX_AGE_MS = 10 * 60 * 1000;

export interface SignInCallback {
  code: string;
  handoff: string | null;
  flowId: string | null;
}

/** The sign-in code in a returning URL's query string, if any. */
export function readSignInCallback(search: string): SignInCallback | null {
  const params = new URLSearchParams(search);
  const code = params.get('code');
  if (!isAuthCode(code)) return null;
  const handoff = params.get('handoff');
  return {
    code: code!,
    handoff: isAuthCode(handoff) ? handoff : null,
    flowId: params.get('sb_flow_id'),
  };
}

/** Where Google sends the person back to. The Home Screen app adds a hand-over id. */
export function signInRedirect(origin: string, now: number = Date.now()): string {
  const base = `${origin.replace(/\/+$/, '')}/?signin=1`;
  if (!isStandalone()) return base;
  const id = crypto.randomUUID();
  try {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify({ id, at: now }));
  } catch {
    return base;
  }
  return `${base}&handoff=${id}`;
}

/** The hand-over this app is waiting for, or null. */
export function pendingHandoff(now: number = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; at?: number };
    if (!isAuthCode(parsed.id ?? null) || typeof parsed.at !== 'number' || now - parsed.at > HANDOFF_MAX_AGE_MS) {
      localStorage.removeItem(HANDOFF_KEY);
      return null;
    }
    return parsed.id!;
  } catch {
    return null;
  }
}

export function clearHandoff(): void {
  try {
    localStorage.removeItem(HANDOFF_KEY);
  } catch {
    // ignore
  }
}

/** Removes the sign-in parameters from the address bar. */
export function cleanSignInUrl(): void {
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch {
    // ignore
  }
}

/** In the Safari window: leave the code for the app. False when that failed. */
export async function passSignInToApp(cb: SignInCallback): Promise<boolean> {
  if (!cb.handoff) return false;
  const { error } = await supabase.rpc('put_auth_handoff', { p_id: cb.handoff, p_code: cb.code, p_flow_id: cb.flowId });
  return !error;
}

export type HandoffResult = 'signed-in' | 'waiting' | 'failed';

/** In the app: pick up the code if the Safari window left it, and sign in. */
export async function collectSignIn(id: string): Promise<HandoffResult> {
  const { data, error } = await supabase.rpc('take_auth_handoff', { p_id: id });
  if (error) return 'waiting';
  const found = data as { code?: string; flow_id?: string | null } | null;
  if (!found?.code) return 'waiting';
  clearHandoff();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    found.code,
    found.flow_id ? { flowId: found.flow_id } : undefined,
  );
  return exchangeError ? 'failed' : 'signed-in';
}
