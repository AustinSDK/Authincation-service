const formData = require('form-data');
const Mailgun = require('mailgun.js');
const crypto = require('crypto');
const dotenv = require('dotenv');
const db = require('./db.js');
const ejs = require('ejs');
const path = require('path');

dotenv.config();

class Email {
    constructor() {
        this.mailgun = new Mailgun(formData);
        this.mg = this.mailgun.client({
            username: 'api',
            key: process.env.mailGunApiKey
        });
        this.fromAddr = process.env.mailGunFromAddr;
        this.fromName = process.env.mailGunFromName;
        this.domain = this.fromAddr.split('@')[1];
        
        this.codeExpiration = 15 * 60 * 1000; // 15 minutes in milliseconds
    }

    /**
     * Generate a random 6-digit verification code
     * @returns {string} - 6-digit verification code
     */
    generateCode() {
        const code = crypto.randomInt(100000, 999999).toString();
        return code;
    }

    /**
     * Check if a verification code is valid
     * @param {string} email - The email address associated with the code
     * @param {string} code - The verification code to check
     * @param {string} purpose - Purpose of the verification (default: 'verify_email')
     * @returns {boolean} - True if code is valid and not expired
     */
    isCodeValid(email, code, purpose = 'verify_email') {
        try {
            const verification = db.prepare(`
                SELECT * FROM email_verifications 
                WHERE email = ? AND token = ? AND purpose = ? AND used = 0
            `).get(email, code, purpose);
            
            if (!verification) {
                return false;
            }

            const expiresAt = new Date(verification.expires_at).getTime();
            const now = Date.now();
            
            // Check if code hasn't expired
            if (now < expiresAt) {
                // Mark code as used
                db.prepare(`
                    UPDATE email_verifications 
                    SET used = 1, verified_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `).run(verification.id);
                return true;
            }

            // Clean up expired code
            db.prepare(`DELETE FROM email_verifications WHERE id = ?`).run(verification.id);
            return false;
        } catch (error) {
            console.error('Error validating code:', error);
            return false;
        }
    }

    /**
     * Send verification email with code using EJS template
     * @param {string} to - Recipient email address
     * @param {object} options - Optional parameters
     * @param {string} options.subject - Email subject
     * @param {string} options.purpose - Purpose of verification (default: 'verify_email')
     * @param {number} options.userId - User ID if associated with a user
     * @param {string} options.username - Username for personalization
     * @param {string} options.ipAddress - IP address of the requester
     * @param {object} options.meta - Additional metadata to store
     * @param {boolean} options.useTemplate - Whether to use EJS template (default: true)
     * @returns {Promise<object>} - Mailgun response with code info
     */
    async sendVerificationEmail(to, options = {}) {
        const {
            subject = 'Email Verification Code',
            purpose = 'verify_email',
            userId = null,
            username = null,
            ipAddress = null,
            meta = null,
            useTemplate = true
        } = options;

        const code = this.generateCode();
        const expiresAt = new Date(Date.now() + this.codeExpiration).toISOString();
        
        try {
            // Check if there's an existing unused code for this email/purpose
            const existing = db.prepare(`
                SELECT * FROM email_verifications 
                WHERE email = ? AND purpose = ? AND used = 0 AND expires_at > CURRENT_TIMESTAMP
            `).get(to, purpose);

            if (existing) {
                // Update the existing record
                db.prepare(`
                    UPDATE email_verifications 
                    SET token = ?, expires_at = ?, sent_count = sent_count + 1, 
                        last_sent_at = CURRENT_TIMESTAMP, ip_address = ?, meta = ?
                    WHERE id = ?
                `).run(code, expiresAt, ipAddress, meta ? JSON.stringify(meta) : null, existing.id);
            } else {
                // Insert new verification record
                db.prepare(`
                    INSERT INTO email_verifications 
                    (user_id, email, token, purpose, expires_at, sent_count, last_sent_at, ip_address, meta)
                    VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, ?)
                `).run(userId, to, code, purpose, expiresAt, ipAddress, meta ? JSON.stringify(meta) : null);
            }

            let htmlContent;
            
            if (useTemplate) {
                // Render EJS template
                const templatePath = path.join(__dirname, '..', 'pages', 'emails', 'verification.ejs');
                htmlContent = await ejs.renderFile(templatePath, {
                    code,
                    username,
                    appName: process.env.APP_NAME || 'AustinSDK Email Authentication',
                    supportEmail: process.env.SUPPORT_EMAIL || this.fromAddr,
                    expiryMinutes: Math.floor(this.codeExpiration / 60000)
                });
            } else {
                // Fallback to simple HTML
                htmlContent = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Email Verification</h2>
                        <p>Your verification code is:</p>
                        <h1 style="color: #4CAF50; font-size: 36px; letter-spacing: 5px;">${code}</h1>
                        <p>This code will expire in 15 minutes.</p>
                        <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
                    </div>
                `;
            }

            const messageData = {
                from: `${this.fromName} <${this.fromAddr}>`,
                to: to,
                subject: subject,
                text: `Your verification code is: ${code}\n\nThis code will expire in 15 minutes.`,
                html: htmlContent
            };

            const response = await this.mg.messages.create(this.domain, messageData);
            console.log(`Verification email sent to ${to}`);
            return { ...response, code }; // Include code in response for testing
        } catch (error) {
            console.error('Error sending email:', error);
            // Delete the code if email fails to send
            db.prepare(`
                DELETE FROM email_verifications 
                WHERE email = ? AND token = ? AND used = 0
            `).run(to, code);
            throw error;
        }
    }

    /**
     * Clean up expired codes from database
     * @returns {number} - Number of codes deleted
     */
    cleanupExpiredCodes() {
        try {
            const result = db.prepare(`
                DELETE FROM email_verifications 
                WHERE expires_at < CURRENT_TIMESTAMP
            `).run();
            
            console.log(`Cleaned up ${result.changes} expired verification codes`);
            return result.changes;
        } catch (error) {
            console.error('Error cleaning up expired codes:', error);
            return 0;
        }
    }

    /**
     * Get verification code info (for debugging/admin purposes)
     * @param {string} email - Email address
     * @param {string} purpose - Purpose of verification
     * @returns {object|null} - Verification info or null
     */
    getVerificationInfo(email, purpose = 'verify_email') {
        try {
            return db.prepare(`
                SELECT id, email, purpose, expires_at, created_at, sent_count, last_sent_at, used, verified_at
                FROM email_verifications 
                WHERE email = ? AND purpose = ?
                ORDER BY created_at DESC
                LIMIT 1
            `).get(email, purpose);
        } catch (error) {
            console.error('Error getting verification info:', error);
            return null;
        }
    }

    /**
     * Set user's email, mark as unverified, and send verification email
     * @param {number} userId - User ID
     * @param {string} email - Email address to set
     * @param {object} options - Optional parameters
     * @param {string} options.ipAddress - IP address of the requester
     * @param {boolean} options.sendEmail - Whether to send verification email (default: true)
     * @returns {Promise<object>} - Result object with success status and message
     */
    async setUserEmailAndVerify(userId, email, options = {}) {
        const {
            ipAddress = null,
            sendEmail = true
        } = options;

        try {
            // Get user information
            const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
            
            if (!user) {
                return {
                    success: false,
                    message: 'User not found',
                    error: 'USER_NOT_FOUND'
                };
            }

            // Check if email is already in use by another user
            const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
            
            if (existingEmail) {
                return {
                    success: false,
                    message: 'Email is already in use by another account',
                    error: 'EMAIL_IN_USE'
                };
            }

            // Update user's email and mark as unverified
            db.prepare(`
                UPDATE users 
                SET email = ?, email_verified = 0 
                WHERE id = ?
            `).run(email, userId);

            console.log(`Email set for user ${userId}: ${email} (unverified)`);

            if (sendEmail) {
                // Send verification email
                const emailResult = await this.sendVerificationEmail(email, {
                    subject: 'Verify Your Email Address',
                    purpose: 'verify_email',
                    userId: userId,
                    username: user.username,
                    ipAddress: ipAddress,
                    meta: {
                        action: 'email_change',
                        timestamp: new Date().toISOString()
                    },
                    useTemplate: true
                });

                return {
                    success: true,
                    message: 'Email set successfully. Verification email sent.',
                    email: email,
                    userId: userId,
                    emailSent: true,
                    verificationCode: emailResult.code // Include for testing only
                };
            } else {
                return {
                    success: true,
                    message: 'Email set successfully. No verification email sent.',
                    email: email,
                    userId: userId,
                    emailSent: false
                };
            }

        } catch (error) {
            console.error('Error setting user email:', error);
            return {
                success: false,
                message: 'Failed to set email and send verification',
                error: error.message
            };
        }
    }

    /**
     * Verify user's email with code
     * @param {number} userId - User ID
     * @param {string} code - Verification code
     * @returns {object} - Result object with success status
     */
    verifyUserEmail(userId, code) {
        try {
            // Get user's email
            const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
            
            if (!user || !user.email) {
                return {
                    success: false,
                    message: 'User not found or no email set',
                    error: 'USER_OR_EMAIL_NOT_FOUND'
                };
            }

            // Validate the code
            const isValid = this.isCodeValid(user.email, code, 'verify_email');
            
            if (isValid) {
                // Mark email as verified
                db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);
                
                console.log(`Email verified for user ${userId}: ${user.email}`);
                
                return {
                    success: true,
                    message: 'Email verified successfully',
                    email: user.email,
                    userId: userId
                };
            } else {
                return {
                    success: false,
                    message: 'Invalid or expired verification code',
                    error: 'INVALID_CODE'
                };
            }

        } catch (error) {
            console.error('Error verifying user email:', error);
            return {
                success: false,
                message: 'Failed to verify email',
                error: error.message
            };
        }
    }
}

module.exports = Email;