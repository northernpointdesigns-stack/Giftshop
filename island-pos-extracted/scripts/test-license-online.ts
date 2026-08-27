/**
 * Manual integration probe for the LemonSqueezy license path.
 *
 * Run AFTER you have a real license key + the buyer's email from a
 * LemonSqueezy purchase (test-mode products work too):
 *
 *   npx tsx scripts/test-license-online.ts <license-key> <customer@email>
 *
 * It calls LemonSqueezy's public License API /activate endpoint and prints the
 * parsed result plus the raw response, so you can confirm the exact success/
 * failure shape that src/services/license.ts parses.
 */
import { LEMON_SQUEEZY_LICENSE_API, verifyLicenseOnline } from '../src/services/license';

const [key, email] = process.argv.slice(2);

if (!key || !email) {
  console.error('\nUsage: npx tsx scripts/test-license-online.ts <license-key> <customer@email>\n');
  console.error('Example:');
  console.error('  npx tsx scripts/test-license-online.ts LSKEY-XXXX-YYYY-JANE jane@beachshop.sc\n');
  process.exit(1);
}

(async () => {
  console.log(`\nActivating LemonSqueezy key for ${email} ...`);
  console.log('Endpoint:', LEMON_SQUEEZY_LICENSE_API);

  const res = await verifyLicenseOnline(email, key);
  console.log('Parsed result:', JSON.stringify(res, null, 2));

  // Dump the raw LS response for shape confirmation.
  const form = new URLSearchParams({ license_key: key, email, instance_name: 'IslandPOSTest' });
  try {
    const r = await fetch(LEMON_SQUEEZY_LICENSE_API, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const text = await r.text();
    console.log(`\nHTTP ${r.status} ${r.statusText}`);
    try {
      console.log('Raw JSON:', JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log('Raw body:', text);
    }
  } catch (e) {
    console.log('Raw fetch failed:', (e as Error)?.message ?? e);
  }
})();
