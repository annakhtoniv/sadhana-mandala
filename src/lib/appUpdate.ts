/**
 * Keeps every browser on the latest version of the app.
 * The app works offline, so the browser keeps a saved copy of it. Without
 * this file a person saw the old copy until they opened the site twice.
 * Now the browser looks for a new version when the app opens and each time
 * the person comes back to it, and reloads once by itself when one is found.
 * There is no check while the app stays on screen, so a reload never
 * interrupts someone halfway through typing.
 */
import { registerSW } from 'virtual:pwa-register';

// Looking more often than this when the person switches back and forth is pointless
const MIN_GAP_MS = 60 * 1000;

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      let lastCheck = Date.now();
      const check = () => {
        if (document.visibilityState !== 'visible' || !navigator.onLine) return;
        if (Date.now() - lastCheck < MIN_GAP_MS) return;
        lastCheck = Date.now();
        registration.update().catch(() => {
          // Offline or the site is unreachable: try again next time
        });
      };
      document.addEventListener('visibilitychange', check);
      window.addEventListener('online', check);
    },
  });
}
