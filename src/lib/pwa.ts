// PWA service worker registration + offline sync bootstrapping
import { initOfflineSync } from '@/lib/offline';

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // SW registration is best-effort; app still works without it
      });
    });
  }
}

export function initOfflineSystems(handlers?: { onSynced?: (n: number) => void; onQueued?: (n: number) => void }) {
  registerServiceWorker();
  return initOfflineSync(handlers?.onSynced, handlers?.onQueued);
}
