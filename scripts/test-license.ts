import { generateLicenseKey, verifyLicense, activateLicense } from '../src/services/license';

(async () => {
  const email = 'jane@beachshop.sc';
  const key = await generateLicenseKey(email);
  console.log('Issued key:', key);
  console.log('Deterministic (same twice):', (await generateLicenseKey(email)) === key);
  console.log('Verify correct email+key:', await verifyLicense(email, key));
  console.log('Verify wrong email:', await verifyLicense('other@x.com', key));
  console.log('Verify tampered key:', await verifyLicense(email, key.slice(0, -2) + 'AA'));
  console.log('Verify sloppy formatting:', await verifyLicense(' Jane@BeachshopSc ', key.toLowerCase().split('-').join(' ')));
  const act = await activateLicense(email, key);
  console.log('activateLicense ok:', act.ok, act.error || '');
  const bad = await activateLicense(email, 'AAAAA-AAAAA-AAAAA-AAAAA');
  console.log('activateLicense rejects bad:', !bad.ok);
})();
