/**
 * Manual integration probe for the Payhip license path.
 *
 * Run AFTER you have a real license key + the buyer's email from a Payhip
 * purchase and the product secret in env:
 *
 *   PAYHIP_PRODUCT_SECRET=prod_sk_xxx npx tsx scripts/test-license-online.ts <license-key> <customer@email>
 *
 * Calls Payhip's public License API verify endpoint and prints the parsed
 * result plus the raw response, so you can confirm the exact success/failure
 * shape that src/services/license.ts (verifyLicensePayhip) parses.
 */
import { PAYHIP_LICENSE_VERIFY_API } from '../src/services/license';

const [key, email] = process.argv.slice(2);
const secret = process.env.PAYHIP_PRODUCT_SECRET || '';

if (!key || !email || !secret) {
  console.error('\nUsage: PAYHIP_PRODUCT_SECRET=prod_sk_xxx npx tsx scripts/test-license-online.ts <license-key> <customer@email>\n');
  if (!secret) console.error('Missing PAYHIP_PRODUCT_SECRET (your Payhip product secret).\n');
  process.exit(1);
}

(async () => {
  const url = `${PAYHIP_LICENSE_VERIFY_API}?license_key=${encodeURIComponent(key)}&product_secret=${encodeURIComponent(secret)}`;
  console.log(`\nVerifying Payhip key for ${email} ...`);
  console.log('Endpoint:', PAYHIP_LICENSE_VERIFY_API);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await r.text();
    console.log(`\nHTTP ${r.status} ${r.statusText}`);
    try {
      console.log('Raw JSON:', JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log('Raw body:', text);
    }
  } catch (e) {
    console.log('Fetch failed:', (e as Error)?.message ?? e);
    process.exit(1);
  }
})();
