/**
 * Service Worker Registration and Lifecycle Manager
 */

export interface SWRegistrationInfo {
  isSupported: boolean;
  isRegistered: boolean;
  registration: ServiceWorkerRegistration | null;
  hasUpdate: boolean;
}

type SWUpdateCallback = () => void;
const updateListeners: Set<SWUpdateCallback> = new Set();

let swRegistration: ServiceWorkerRegistration | null = null;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('[SWRegister] Service Workers not supported in this environment');
    return Promise.resolve(null);
  }

  return navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registration) => {
      swRegistration = registration;
      console.log('[SWRegister] Service Worker registered successfully with scope:', registration.scope);

      // Check for updates
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SWRegister] New Service Worker content available; update pending.');
            notifyUpdateListeners();
          }
        };
      };

      // Listen for controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SWRegister] Controller changed; reloading window or updating state.');
      });

      // Register Background Sync if supported
      if ('sync' in registration) {
        (registration as any).sync
          .register('sync-pos-transactions')
          .catch((err: any) => console.log('[SWRegister] Background sync registration optional:', err));
      }

      return registration;
    })
    .catch((error) => {
      console.warn('[SWRegister] Service Worker registration failed:', error);
      return null;
    });
}

export function subscribeSWUpdate(callback: SWUpdateCallback): () => void {
  updateListeners.add(callback);
  return () => updateListeners.delete(callback);
}

function notifyUpdateListeners() {
  updateListeners.forEach((cb) => cb());
}

export function triggerSWBackgroundSync(): void {
  if (swRegistration && 'sync' in swRegistration) {
    (swRegistration as any).sync
      .register('sync-pos-transactions')
      .catch((err: any) => console.log('[SWRegister] Sync register error:', err));
  } else if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' });
  }
}

export function getSWRegistration(): ServiceWorkerRegistration | null {
  return swRegistration;
}
