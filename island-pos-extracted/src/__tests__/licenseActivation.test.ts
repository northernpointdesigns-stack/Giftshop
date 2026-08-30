import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';

/**
 * Activation-chain tests: LemonSqueezy → Payhip → offline HMAC fallback.
 * fetch is stubbed globally; each test re-imports license.ts so the
 * build-time env flags (VITE_PAYHIP_PRODUCT_SECRET) are re-read.
 */

const PAYHIP_URL = 'https://payhip.com/api/v2/license/verify?license_key=';

const lsResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const payhipOk = (buyerEmail: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ data: { enabled: true, buyer_email: buyerEmail, uses: 1 } }),
});

const payhipDisabled = () => ({
  ok: true,
  status: 200,
  json: async () => ({ data: { enabled: false } }),
});

describe('activateLicense provider chain', () => {
  let activateLicense: typeof import('../services/license').activateLicense;
  let generateLicenseKey: typeof import('../services/license').generateLicenseKey;
  let clearLicense: typeof import('../services/license').clearLicense;

  const loadModule = async (payhipSecret?: string) => {
    vi.resetModules();
    vi.unstubAllEnvs();
    if (payhipSecret) vi.stubEnv('VITE_PAYHIP_PRODUCT_SECRET', payhipSecret);
    const mod = await import('../services/license');
    activateLicense = mod.activateLicense;
    generateLicenseKey = mod.generateLicenseKey;
    clearLicense = mod.clearLicense;
  };

  beforeEach(async () => {
    await loadModule('TEST-PRODUCT-SECRET');
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('activates via LemonSqueezy when the LS check succeeds (Payhip never called)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://api.lemonsqueezy.com')) {
        return lsResponse({ valid: true });
      }
      throw new Error('Payhip should not be called');
    }) as unknown as Mock;
    vi.stubGlobal('fetch', fetchMock);

    const res = await activateLicense('buyer@example.com', 'ABCDEFGHJKLMNPQRST');
    expect(res).toEqual({ ok: true, source: 'lemonsqueezy' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('lemonsqueezy');
    expect(localStorage.getItem('pos_license_v1')).toBeTruthy();
  });

  it('falls through to Payhip when LemonSqueezy rejects, and activates on enabled key', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://api.lemonsqueezy.com')) {
        return lsResponse({ error: 'license_key not found.' }, 404);
      }
      if (url.startsWith(PAYHIP_URL)) {
        return payhipOk('buyer@example.com');
      }
      throw new Error('Unexpected fetch: ' + url);
    }) as unknown as Mock;
    vi.stubGlobal('fetch', fetchMock);

    const res = await activateLicense('buyer@example.com', 'WTKP4-66NL5-HMKQW-GFSCZ');
    expect(res).toEqual({ ok: true, source: 'payhip' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('pos_license_v1')).toBeTruthy();
  });

  it('rejects a Payhip key whose buyer email does not match the entered email', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('https://api.lemonsqueezy.com')) {
          return lsResponse({ error: 'license_key not found.' }, 404);
        }
        return payhipOk('someone.else@example.com');
      }) as unknown as Mock,
    );

    const res = await activateLicense('buyer@example.com', 'WTKP4-66NL5-HMKQW-GFSCZ');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/different email/i);
    expect(localStorage.getItem('pos_license_v1')).toBeNull();
  });

  it('rejects a disabled Payhip key (no activation, no offline rescue)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('https://api.lemonsqueezy.com')) {
          return lsResponse({ error: 'license_key not found.' }, 404);
        }
        return payhipDisabled();
      }) as unknown as Mock,
    );

    const res = await activateLicense('buyer@example.com', 'WTKP4-66NL5-HMKQW-GFSCZ');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/disabled/i);
    expect(localStorage.getItem('pos_license_v1')).toBeNull();
  });

  it('falls back to the offline HMAC path when both providers cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as Mock,
    );

    const email = 'owner.key@example.com';
    const key = await generateLicenseKey(email);
    const res = await activateLicense(email, key);
    expect(res).toEqual({ ok: true, source: 'offline' });
    expect(localStorage.getItem('pos_license_v1')).toBeTruthy();
  });

  it('skips the Payhip path entirely when no product secret is configured', async () => {
    await loadModule(undefined);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://api.lemonsqueezy.com')) {
        return lsResponse({ error: 'license_key not found.' }, 404);
      }
      throw new Error('Payhip should not be called');
    }) as unknown as Mock;
    vi.stubGlobal('fetch', fetchMock);

    const email = 'owner.key@example.com';
    const key = await generateLicenseKey(email);
    const res = await activateLicense(email, key);
    expect(res).toEqual({ ok: true, source: 'offline' });
    // Exactly one fetch: LemonSqueezy only.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects keys that are too short without contacting any provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await activateLicense('buyer@example.com', 'SHORT');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/too short/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clearLicense removes the stored license', () => {
    localStorage.setItem(
      'pos_license_v1',
      JSON.stringify({ key: 'X', email: 'x@x.com', activatedAt: new Date().toISOString() }),
    );
    clearLicense();
    expect(localStorage.getItem('pos_license_v1')).toBeNull();
  });
});
