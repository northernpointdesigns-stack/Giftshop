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
    const env = (import.meta as { env?: Record<string, string | undefined> } | undefined)?.env;
    const flag = env?.VITE_DISABLE_LICENSE;
    return flag === '1' || flag === 'true';
  } catch {
    return false;
  }
}
export const LICENSE_DISABLED = readLicenseDisabledFlag();
/** Where customers buy — point this at your Gumroad / Lemon Squeezy / Paddle page */
export const PURCHASE_URL = 'https://your-store.example.com/buy';
export const SUPPORT_EMAIL = 'support@your-store.example.com';

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
 * Returns an ok/error result; stores the license on success.
 */
export async function activateLicense(
  email: string,
  key: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmedEmail = email.trim();
  const trimmedKey = key.trim();
  if (!trimmedEmail || !trimmedKey) return { ok: false, error: 'Please enter both your purchase email and license key.' };

  // Basic format sanity: at least 16 alphanumeric characters
  if (normalizeKey(trimmedKey).length < 16) {
    return { ok: false, error: 'That key looks too short — check for missing characters.' };
  }

  const valid = await verifyLicense(trimmedEmail, trimmedKey);
  if (!valid) {
    return {
      ok: false,
      error: 'This key does not match the email entered. Keys are tied to the exact purchase email address.',
    };
  }
  storeLicense(trimmedEmail, trimmedKey);
  return { ok: true };
}

