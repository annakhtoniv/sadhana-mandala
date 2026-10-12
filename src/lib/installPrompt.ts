/**
 * "Install app" (PWA). Chrome and Edge on Android and desktop fire
 * beforeinstallprompt once, early, so it is captured when the app loads.
 * iPhone Safari has no prompt: the person uses Share > Add to Home Screen.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((fn) => fn());
  });
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  await event.prompt();
  const choice = await event.userChoice;
  listeners.forEach((fn) => fn());
  return choice.outcome === 'accepted';
}

/** Already running as an installed app. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

export function isIos(userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}
