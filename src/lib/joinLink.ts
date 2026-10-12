/**
 * Batch QR join links.
 *
 * A batch QR code (or shared link) opens the app with ?code=JOINCODE. Older
 * printed QR codes from the admin screen used ?join=JOINCODE, so both work.
 * The code is kept on the device across the Google sign-in redirect and the
 * person is enrolled as soon as they are signed in.
 */

export const PENDING_JOIN_KEY = 'sadhana_pending_join_code';
export const PENDING_CHECKIN_KEY = 'sadhana_pending_event_checkin';

/** A pending code is forgotten after a day, so an old scan never enrols someone later. */
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function cleanCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

/** The link a batch QR code points to. */
export function batchJoinUrl(joinCode: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}/?code=${encodeURIComponent(cleanCode(joinCode))}`;
}

/** The batch join code and event check-in code in a URL query string, if any. */
export function readLinkParams(search: string): { joinCode: string | null; eventCode: string | null } {
  const params = new URLSearchParams(search);
  const join = params.get('code') || params.get('join');
  const event = params.get('event');
  return {
    joinCode: join && cleanCode(join) ? cleanCode(join) : null,
    eventCode: event && cleanCode(event) ? cleanCode(event) : null,
  };
}

export function savePending(key: string, code: string, now: number = Date.now()): void {
  try {
    localStorage.setItem(key, JSON.stringify({ code, at: now }));
  } catch {
    // ignore storage errors (private mode)
  }
}

/** The pending code, or null when there is none or it is older than a day. */
export function peekPending(key: string, now: number = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: string; at?: number };
    if (!parsed.code || typeof parsed.at !== 'number' || now - parsed.at > PENDING_MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

/** Reads and forgets the pending code. */
export function takePending(key: string, now: number = Date.now()): string | null {
  const code = peekPending(key, now);
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
  return code;
}

export function clearPending(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
