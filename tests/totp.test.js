const assert = require('assert');
const path = require('path');

// Require the library under test
const totp = require(path.join(__dirname, '..', 'src', 'libs', 'totp'));

(async function runTests(){
  // generate secret
  const secret = totp.generateSecret();
  assert.strictEqual(typeof secret, 'string', 'secret should be a string');
  assert.ok(secret.length >= 16, 'secret should be reasonably long');

  // generate TOTP
  const { otp, expires } = totp.generateTOTP(secret);
  assert.match(otp, /^\d+$/, 'otp should be numeric');
  assert.strictEqual(otp.length, 6, 'otp should be 6 digits by default');
  assert.ok(typeof expires === 'number' && expires > Date.now(), 'expires should be a future timestamp (ms)');

  // otpauth url
  const label = 'user@example.com';
  const issuer = 'TestApp';
  const url = totp.getOtpauthURL(secret, label, issuer);
  assert.ok(typeof url === 'string' && url.startsWith('otpauth://'), 'otpauth url should start with otpauth://');
  assert.ok(url.includes('secret='), 'otpauth url must include secret param');

  // local QR data URI
  const dataUrl = await totp.getQRCodeDataURL(secret, label, issuer, 150);
  assert.ok(typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png;base64,'), 'QR data URL should be a PNG data URI');

  console.log('tests/totp.test.js: all checks passed');
})().catch(err => {
  console.error('tests/totp.test.js: FAILED');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
