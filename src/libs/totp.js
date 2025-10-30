/*
  TOTP utilities using the `otpauth` package.
  Provides:
    - generateSecret(bytes) -> base32 secret string
    - generateTOTP(secretBase32, options) -> { otp, expires }
    - getOtpauthURL(secretBase32, label, issuer, options) -> otpauth://... URL
    - getGoogleQRCodeURL(secretBase32, label, issuer, size) -> Google Chart QR image URL (can be used in <img>)

  These helpers make it easy to import into Google Authenticator by creating a
  standard otpauth:// URL (and a QR URL for convenient scanning).
*/

const OTPAuth = require('otpauth');
const crypto = require('crypto');
const QRCode = require('qrcode');

/**
 * Generate a random secret and return it as a base32 string.
 * Uses secure random bytes and converts to base32 via OTPAuth.Secret.fromHex.
 *
 * @param {number} bytes - number of random bytes to generate (default 20 -> 160 bits)
 * @returns {string} base32 encoded secret
 */
function generateSecret(bytes = 20){
    const hex = crypto.randomBytes(bytes).toString('hex');
    const secretObj = OTPAuth.Secret.fromHex(hex);
    // OTPAuth.Secret.prototype has a `base32` property
    return secretObj.base32;
}

/**
 * Generate a TOTP code for a given base32 secret.
 * Returns the OTP and the expiration timestamp (ms since epoch) for compatibility
 * with previous API shapes.
 *
 * @param {string} secretBase32 - base32 encoded secret
 * @param {Object} opts - options: { digits=6, period=30, algorithm='SHA1' }
 * @returns {Object} { otp: string, expires: number }
 */
function generateTOTP(secretBase32, opts = {}){
    const { digits = 6, period = 30, algorithm = 'SHA1' } = opts;
    const secret = OTPAuth.Secret.fromBase32(secretBase32);
    const totp = new OTPAuth.TOTP({
        secret,
        algorithm,
        digits,
        period
    });

    const otp = totp.generate();
    // seconds remaining in this period
    const remaining = totp.remaining();
    const expires = Date.now() + (remaining * 1000);
    return { otp, expires };
}

/**
 * Build a standard otpauth:// URL suitable for importing into Google Authenticator
 * and other authenticator apps.
 *
 * @param {string} secretBase32 - base32 encoded secret
 * @param {string} label - usually account (e.g. user@example.com)
 * @param {string} issuer - issuer/provider name (shown in authenticator apps)
 * @param {Object} opts - { digits=6, period=30, algorithm='SHA1' }
 * @returns {string} otpauth URL
 */
function getOtpauthURL(secretBase32, label = '', issuer = '', opts = {}){
    const { digits = 6, period = 30, algorithm = 'SHA1' } = opts;
    const secret = OTPAuth.Secret.fromBase32(secretBase32);
    const totp = new OTPAuth.TOTP({
        secret,
        label: label || undefined,
        issuer: issuer || undefined,
        algorithm,
        digits,
        period
    });
    // OTPAuth.TOTP.prototype.toString() returns the otpauth:// URL
    return totp.toString();
}

/**
 * Helper that returns a Google Charts QR URL for the otpauth URL. This can be
 * embedded into an <img> element for users to scan with Google Authenticator.
 * Note: This uses an external Google Charts URL (no local QR generation).
 *
 * @param {string} secretBase32
 * @param {string} label
 * @param {string} issuer
 * @param {number} size - pixel size for the square QR image (default 200)
 * @returns {string} URL to PNG QR image
 */
function getGoogleQRCodeURL(secretBase32, label = '', issuer = '', size = 200){
    const otpauth = getOtpauthURL(secretBase32, label, issuer);
    const encoded = encodeURIComponent(otpauth);
    // Google Chart API for QR codes (simple and widely used)
    return `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encoded}`;
}

/**
 * Generate a QR code data URL (PNG) locally for the otpauth URL.
 * Returns a Promise resolving to a data:image/png;base64,... URI which can be
 * embedded directly in an <img src="..."> element.
 *
 * @param {string} secretBase32
 * @param {string} label
 * @param {string} issuer
 * @param {number} size - pixel size for the generated QR (default 200)
 * @returns {Promise<string>} data URI string
 */
async function getQRCodeDataURL(secretBase32, label = '', issuer = '', size = 200){
    const otpauth = getOtpauthURL(secretBase32, label, issuer);
    try{
        const dataUrl = await QRCode.toDataURL(otpauth, { width: size });
        return dataUrl;
    }catch(err){
        // propagate error
        throw err;
    }
}

/**
 * Verify a TOTP code against a secret
 * Allows a small window of tolerance for clock skew (previous/current/next period)
 *
 * @param {string} secretBase32 - base32 encoded secret
 * @param {string} token - the TOTP code to verify (6 digits)
 * @param {Object} opts - { digits=6, period=30, algorithm='SHA1', window=1 }
 * @returns {boolean} true if token is valid
 */
function verifyTOTP(secretBase32, token, opts = {}){
    const { digits = 6, period = 30, algorithm = 'SHA1', window = 1 } = opts;
    const secret = OTPAuth.Secret.fromBase32(secretBase32);
    const totp = new OTPAuth.TOTP({
        secret,
        algorithm,
        digits,
        period
    });
    
    // OTPAuth.TOTP.validate returns the time step delta if valid, null otherwise
    // window parameter allows checking tokens from adjacent time periods
    const delta = totp.validate({ token, window });
    return delta !== null;
}

module.exports = {
    generateSecret,
    generateTOTP,
    getOtpauthURL,
    getGoogleQRCodeURL,
    getQRCodeDataURL,
    verifyTOTP
};