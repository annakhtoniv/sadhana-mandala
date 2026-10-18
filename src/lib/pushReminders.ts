/**
 * Daily practice reminders (Phase 18): this phone's push notifications.
 * The phone asks the person once (it must follow a tap), then gives us an
 * address that only the browser's own push service can deliver to. We save
 * it; the sender (supabase/functions/send-reminders) uses it every Morning
 * and Evening. iPhone delivers notifications only to an app on the Home
 * Screen, never to a Safari tab.
 */
import { supabase } from './supabase';
import { isIos, isStandalone } from './installPrompt';

// Public half of the key pair; the private half is a Supabase secret
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export type ReminderState = 'unsupported' | 'install-first' | 'blocked' | 'off' | 'on';

/** The key in the form the browser wants it (URL-safe base64 to bytes). */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function save(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh || '',
    p_auth: json.keys?.auth || '',
  });
  if (error) throw error;
}

export async function reminderState(): Promise<ReminderState> {
  // On iPhone, a Safari tab has no push at all; the Home Screen app does
  if (isIos() && !isStandalone()) return 'install-first';
  if (!pushSupported() || !VAPID_PUBLIC_KEY) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'off';
  return (await currentSubscription()) ? 'on' : 'off';
}

/** Call from a tap. Returns the new state. */
export async function turnRemindersOn(): Promise<ReminderState> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));
  await save(sub);
  return 'on';
}

export async function turnRemindersOff(): Promise<ReminderState> {
  const sub = await currentSubscription();
  if (sub) {
    await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
  return 'off';
}

/**
 * When the app opens: the browser can renew the address, and a phone
 * that another person used before belongs to whoever is signed in now.
 */
export async function resyncReminders(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const sub = await currentSubscription();
  if (sub) await save(sub);
}

/** On sign-out: this phone stops getting the person's reminders. */
export async function forgetRemindersOnThisPhone(): Promise<void> {
  if (!pushSupported()) return;
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}
