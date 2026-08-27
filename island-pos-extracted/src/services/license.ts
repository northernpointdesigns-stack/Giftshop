/**
 * Offline license & trial management for commercial distribution.
 *
 * License keys are deterministic HMAC-style signatures derived from the
 * customer's email + an embedded secret. Validation is fully offline (no
 * server needed) which suits POS terminals that must run without internet.
 *
 * NOTE: client-side licensing is deterrence, not DRM-grade security. For a
 * one-time-purchase product at this price point this is industry-standard.
 */

export const LICENSE_SECRET = 'bps-v1-9c4f7a2e81d5b603';
export const TRIAL_DAYS = 14;

/**
 * Build-time kill switch for the trial/license gate.
 *
 * Set VITE_DISABLE_LICENSE=1 in a local .env.local (git-ignored) to build
 * copies with NO trial timer and NO activation screen — the app runs fully
 * unlocked. Release builds from GitHub do not set this flag, so customer
 * builds keep the normal 14-day trial + license key flow.
 */
function readLicenseDisabledFlag(): boolean {
  try {
    // IMPORTANT: access `import.meta.env.VITE_DISABLE_LICENSE` directly — no
    // optional chaining and no type casts. Vite only statically replaces the
    // exact member expression `import.meta.env.VITE_*` at build time; indirect
    // access (e.g. `import.meta?.env?.VITE_X`) survives into the production
    // bundle where `import.meta.env` is undefined, silently forcing trial
    // mode on regardless of the build environment.
    const flag = import.meta.env.VITE_DISABLE_LICENSE;
    return flag === '1' || flag === 'true';
  } catch {
    return false;
  }
}
export const LICENSE_DISABLED = readLicenseDisabledFlag();

/**
 * Where customers buy (a plain link on the activation screen). Point this at
 * your hosted storefront — e.g. your LemonSqueezy checkout URL:
 *   VITE_PURCHASE_URL=https://your-store.lemonsqueezy.com/buy/lifetime
 * Falls back to the placeholder below when unset.
 */
function readPurchaseUrl(): string {
  try {
    // Vite statically replaces the exact member expression `import.meta.env.VITE_*`
    // at build time. In plain Node/tsx (scripts/test-license.ts) import.meta.env is
    // undefined, so the access throws and we fall through to the default.
    const v = import.meta.env.VITE_PURCHASE_URL;
    if (v) return String(v);
  } catch {}
  return 'https://your-store.example.com/buy';
}
export const PURCHASE_URL = readPurchaseUrl();
export const SUPPORT_EMAIL = 'support@your-store.example.com';

/**
 * LemonSqueezy License API — customer-facing, requires NO store secret.
 * Docs (status enum: inactive | active | expired | disabled; 60 req/min):
 *   https://docs.lemonsqueezy.com/api/license-api
 *
 * We activate against the buyer's email + the key LS generated at checkout.
 * A successful call means the key is `active` for that email; the license is
 * then cached locally so the POS keeps running offline afterwards.
 * (Confirmed against the live endpoint: it expects form fields
 *  `license_key`, `email`, and `instance_name`.)
 */
export const LEMON_SQUEEZY_LICENSE_API = 'https://api.lemonsqueezy.com/v1/licenses/activate';

export interface StoredLicense {
  key: string;
  email: string;
  activatedAt: string;
}

const LICENSE_STORAGE_KEY = 'pos_license_v1';
const TRIAL_STORAGE_KEY = 'pos_trial_start_v1';

/* ------------------------------------------------------------------ */
/* Hashing                                                             */
/* ------------------------------------------------------------------ */

async function sha256Hex(input: string): Promise<string> {
  // Use the platform WebCrypto when available — identical results across
  // browsers, Electron renderers, Android WebViews AND Node (for your
  // scripts/generate-license.ts tool), guaranteeing keys always match.
  const cryptoRef = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto : undefined;
  if (cryptoRef?.subtle) {
    try {
      const data = new TextEncoder().encode(input);
      const digest = await cryptoRef.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      /* fall through to FNV */
    }
  }
  // Fallback: FNV-1a 64-bit-ish (deterministic, non-crypto) so licensing
  // still works in environments without WebCrypto.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ input.charCodeAt(input.length - 1 - i), 2166136261) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 10; i++) {
    h1 = Math.imul(h1 ^ (h2 + i), 2654435761) >>> 0;
    out += h1.toString(16).padStart(8, '0');
    [h1, h2] = [h2, h1];
  }
  return out.slice(0, 80);
}

/** Normalize a key for comparison: uppercase, strip spaces/dashes */
export const normalizeKey = (key: string): string =>
  key.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Generate the license key for a customer email.
 * Used by BOTH the activation flow (to verify) and your private
 * scripts/generate-license.ts tool (to issue keys after payment).
 */
export async function generateLicenseKey(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  const hash = await sha256Hex(`${LICENSE_SECRET}|${normalizedEmail}`);
  // Crockford-style alphabet (no I, L, O, U to avoid transcription errors)
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let raw = '';
  for (let i = 0; i < 20; i++) {
    raw += alphabet[parseInt(hash[i * 2] + hash[i * 2 + 1], 16) % alphabet.length];
  }
  return (raw.match(/.{1,5}/g) || []).join('-');
}

/**
 * Verify a customer-entered key against their email.
 * Accepts any spacing/dashing/casing.
 */
export async function verifyLicense(email: string, key: string): Promise<boolean> {
  if (!email.trim() || !key.trim()) return false;
  const expected = normalizeKey(await generateLicenseKey(email));
    return normalizeKey(key) === expected;
}

/* ------------------------------------------------------------------ */
/* LemonSqueezy online activation                                      */
/* ------------------------------------------------------------------ */

const DEVICE_ID_KEY = 'pos_license_device_id';

/** Stable per-machine instance name so LS reuses (not duplicates) the
 * activation slot across re-activations on the same device. */
function getDeviceInstanceName(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const existing = localStorage.getItem(DEVICE_ID_KEY);
      if (existing) return existing;
      const id = 'IslandPOS-' + Math.random().toString(36).slice(2, 12).toUpperCase();
      localStorage.setItem(DEVICE_ID_KEY, id);
      return id;
    }
  } catch {}
  const suffix = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID().slice(0, 8).toUpperCase()
    : Math.random().toString(36).slice(2, 12).toUpperCase();
  return `IslandPOS-${suffix}`;
}

interface OnlineVerifyResult {
  ok: boolean;
  error?: string;
  /** true when LS was unreachable / undecodable — caller may fall back to offline HMAC */
  unavailable?: boolean;
}

/**
 * Validate (and activate) a LemonSqueezy license key for the given email
 * via LS's public License API. No store secret required.
 *
 * Returns:
 *   { ok: true }                       key is active for this email
 *   { ok: false, unavailable: true }   LS unreachable  -> retryable / fall back
 *   { ok: false, unavailable: false }  LS reachable but key invalid/expired/disabled
 */
export async function verifyLicenseOnline(
  email: string,
  key: string,
  signal?: AbortSignal,
): Promise<OnlineVerifyResult> {
  const form = new URLSearchParams({
    license_key: key,
    email: email,
    instance_name: getDeviceInstanceName(),
  });

  let resp: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      resp = await fetch(LEMON_SQUEEZY_LICENSE_API, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
        signal: signal ?? controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (e: any) {
    const name = e?.name;
    if (name === 'AbortError' && signal?.aborted) {
      return { ok: false, unavailable: false, error: 'Verification cancelled.' };
    }
    return {
      ok: false,
      unavailable: true,
      error: 'Could not reach LemonSqueezy. If you just purchased, try again in a moment, or check your network.',
    };
  }

  if (!resp.ok) {
    let detail: string | undefined;
    try {
      const body = await resp.json();
      detail = typeof body?.message === 'string'
        ? body.message
        : body?.error
          ? String(body.error)
          : `LemonSqueezy validation failed (HTTP ${resp.status}).`;
    } catch {
      detail = `LemonSqueezy responded with HTTP ${resp.status}.`;
    }
    return { ok: false, unavailable: false, error: detail };
  }

  let json: any;
  try {
    json = await resp.json();
  } catch {
    return { ok: false, unavailable: true, error: 'Could not read LemonSqueezy response.' };
  }

  // LS responds either with { valid: true } or a JSON:API-style { license_key: { attributes: { status } } }.
  const active =
    json?.valid === true ||
    json?.license_key?.attributes?.status === 'active' ||
    json?.data?.attributes?.status === 'active';
  if (active) return { ok: true };

  const status = json?.license_key?.attributes?.status ?? json?.status;
  const message = typeof json?.message === 'string'
    ? json.message
    : status
      ? `License key state: ${status}.`
      : 'LemonSqueezy could not verify this license key.';
  return { ok: false, unavailable: false, error: message };
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

const hasStorage = (): boolean => typeof localStorage !== 'undefined';

export function getStoredLicense(): StoredLicense | null {
  try {
    if (!hasStorage()) return null;
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredLicense) : null;
  } catch {
    return null;
  }
}

export function storeLicense(email: string, key: string): StoredLicense {
  const license: StoredLicense = { key, email: email.trim(), activatedAt: new Date().toISOString() };
  if (hasStorage()) localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(license));
  return license;
}

export function clearLicense(): void {
  if (hasStorage()) localStorage.removeItem(LICENSE_STORAGE_KEY);
}

function getTrialStartDate(): Date {
  if (!hasStorage()) return new Date();
  const existing = localStorage.getItem(TRIAL_STORAGE_KEY);
  if (existing) return new Date(existing);
  const now = new Date();
  localStorage.setItem(TRIAL_STORAGE_KEY, now.toISOString());
  return now;
}

/** Days remaining in trial, or null when already licensed (or gate disabled) */
export function trialDaysLeft(): number | null {
  if (LICENSE_DISABLED || getStoredLicense()) return null;
  const start = getTrialStartDate();
  const msLeft = TRIAL_DAYS * 86400000 - (Date.now() - start.getTime());
  if (msLeft > 0) return Math.max(1, Math.ceil(msLeft / 86400000));
  return 0;
}

export type LicenseState =
  | { status: 'checking' }
  | { status: 'licensed'; license: StoredLicense }
  | { status: 'trial'; daysLeft: number }
  | { status: 'locked' };

/** One-call status resolution used by the app shell on startup */
export function resolveLicenseState(): LicenseState {
  // Gate disabled at build time: run fully unlocked, no badge, no lock screen
  if (LICENSE_DISABLED) {
    return {
      status: 'licensed',
      license: { key: 'UNLOCKED-BUILD', email: 'owner@local', activatedAt: new Date().toISOString() },
    };
  }
  const license = getStoredLicense();
  if (license) return { status: 'licensed', license };
  const left = trialDaysLeft();
  if (left !== null && left > 0) return { status: 'trial', daysLeft: left };
  return { status: 'locked' };
}

/**
 * Attempt activation with a customer email + key.
 *
 * Two verification paths, both accepted on success -- the same screen serves
 * LemonSqueezy buyers AND owner-issued HMAC keys:
 *   1. LemonSqueezy License API (primary for DMG buyers). Needs internet once;
 *      the license is cached locally and the POS then runs offline.
 *   2. Offline HMAC (owner keys via scripts/generate-license.ts) and the
 *      no-network fallback when LS cannot be reached.
 */
export async function activateLicense(
  email: string,
  key: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; error?: string; source?: 'lemonsqueezy' | 'offline' }> {
  const trimmedEmail = email.trim();
  const trimmedKey = key.trim();
  if (!trimmedEmail || !trimmedKey) return { ok: false, error: 'Please enter both your purchase email and license key.' };

  // Basic format sanity: at least 16 alphanumeric characters
  if (normalizeKey(trimmedKey).length < 16) {
    return { ok: false, error: 'That key looks too short — check for missing characters.' };
  }

  // 1) Verify with LemonSqueezy's customer License API (the buyer path).
  //    Activated keys are cached locally, so the POS then runs offline.
  const online = await verifyLicenseOnline(trimmedEmail, trimmedKey, signal);
  if (online.ok) {
    storeLicense(trimmedEmail, trimmedKey);
    return { ok: true, source: 'lemonsqueezy' };
  }

  // 2) Offline HMAC fallback: owner-issued keys (scripts/generate-license.ts),
  //    and the no-network fallback when LS cannot be reached.
  if (await verifyLicense(trimmedEmail, trimmedKey)) {
    storeLicense(trimmedEmail, trimmedKey);
    return { ok: true, source: 'offline' };
  }

  // Neither succeeded: surface the online error first (most relevant for a
  // buyer), then the offline mismatch message.
  return {
    ok: false,
    error: online.error || 'This key does not match the email entered. Keys are tied to the exact purchase email address.',
  };
}

