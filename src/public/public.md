# Welcome to Authly

Hello! Welcome to our authentication service project. This page provides comprehensive information about our mission, security practices, and future plans. If you'd like to contribute or suggest improvements, please visit our [GitHub repository](https://github.com/AustinSDK/Authentication-service/)!

## Our Mission

We're building a secure, transparent authentication service that you can trust. Authentication is a critical part of web security, and we understand the responsibility that comes with protecting your credentials. That's why we're committed to transparency at every step.

Check out our [Figma Design](https://www.figma.com/design/94cGUnCbpsUTiaoy4hOaGT/Authly?node-id=9-89&t=tLfbOrG3zFTiA5EL-1) to see what we're building!

## Security First

Security isn't just a feature; it's our foundation. Here's how we protect your information:

### Cryptographic Hashing

We use industry-standard [cryptographic hashing with salt](https://en.wikipedia.org/wiki/Cryptographic_hash_function) wherever possible. This means:

- Your passwords are never stored in plain text
- We can verify your credentials without ever seeing the actual password
- Even if our database were compromised, your passwords remain protected

### Two-Factor Authentication (TOTP)

We implement [Time-based One-Time Passwords (TOTP)](https://en.wikipedia.org/wiki/Time-based_one-time_password) for enhanced security:

- Scan a QR code with your authenticator app
- Generate time-sensitive security codes
- Add an extra layer of protection to your account

**Important:** If you lose access to both your TOTP device and your account credentials, account recovery may not be possible. Please keep your recovery codes safe!

### Privacy-Focused Email System

When you create an account:

- You can provide your email address for full functionality
- Alternatively, we'll generate a pseudo-email for tracking purposes
- Pseudo-emails maintain your privacy but won't receive actual messages
- This gives you control over your data sharing

## Transparency & Trust

We believe trust is earned through transparency. That's why:

- Our code is open source on GitHub
- Our security practices are documented
- We're open to feedback and security audits

Have concerns or suggestions about our security practices? Reach out to [austin@austinsdk.me](mailto:austin@austinsdk.me)

## FAQ

**Q: Do you have a roadmap?**  
A: Absolutely! Check out our development roadmap below:

![Roadmap.svg](/public/Roadmap.svg)

**Q: Is this service free?**  
A: Yes, our authentication service is free and open source.

**Q: Can I self-host this?**  
A: Yes! You can deploy your own instance. Check our GitHub repository for deployment instructions.

**Q: What happens to my data?**  
A: Your credentials are hashed and never stored in plain text. We only store what's necessary to authenticate you securely.

---

Last updated: October 2025
