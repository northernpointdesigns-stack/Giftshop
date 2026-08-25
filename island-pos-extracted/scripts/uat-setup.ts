/**
 * Headless globals so the browser-oriented services can run in Node.
 * Imported FIRST — its side effects run before any dependent module loads.
 *
 * NOTE: deliberately do NOT define `window`, otherwise the scheduled
 * backup service starts setInterval timers and Node never exits.
 */

const store = new Map<string, string>();

function makeStorage(): Storage {
  return {
    get length() {
      return store.size;
    },
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  } as Storage;
}

const sharedStorage = makeStorage();
(globalThis as unknown as { localStorage: Storage }).localStorage = sharedStorage;

// Mirror for anything that uses sessionStorage (e.g. offline-sync engine)
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = makeStorage();

// Define a browser-like window stub so db.initDatabase() runs its full
// seeding path AND browser-service singletons (offline sync watchers, etc.)
// can register listeners. The scheduled-backup timer is harmless because the
// harness always exits via process.exit().
const windowStub: Record<string, unknown> = {
  ...globalThis,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => true,
};
(globalThis as unknown as { window: unknown }).window = windowStub;
try {
  (globalThis as unknown as { navigator: unknown }).navigator =
    (globalThis as unknown as { navigator?: unknown }).navigator || { userAgent: 'node' };
} catch {
  /* Node >= 21 exposes a read-only navigator — fine to leave as-is */
}

export const __localStorageStore = store;
