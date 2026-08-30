/**
 * OWNER-ONLY TOOL — License Key Generator
 * ========================================
 * Run after receiving a payment to issue a key for the customer's email:
 *
 *   npx tsx scripts/generate-license.ts customer@example.com
 *
 * Print the output and send it to the buyer. The key works offline forever
 * on any of their devices, activated together with that email address.
 */
import { generateLicenseKey } from '../src/services/license';

const email = process.argv[2];

if (!email) {
  console.error('\nUsage: npx tsx scripts/generate-license.ts <customer-email>\n');
  console.error('Example:');
  console.error('  npx tsx scripts/generate-license.ts jane@beachshop.sc\n');
  process.exit(1);
}

generateLicenseKey(email)
  .then((key) => {
    console.log('\n================================================');
    console.log('  License issued successfully');
    console.log('================================================');
    console.log(`  Customer email: ${email.trim().toLowerCase()}`);
    console.log(`  License key:    ${key}`);
    console.log('------------------------------------------------');
    console.log('  Send both lines to the customer.');
    console.log('  They enter them together in the app activation screen.\n');
  })
  .catch((err) => {
    console.error('Failed to generate key:', err);
    process.exit(1);
  });

