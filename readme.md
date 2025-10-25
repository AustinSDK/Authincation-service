# Authly!
Authly is a tool for the [AustinSDK](https://auth.austinsdk.me) eco system to be able to use all the created services under one account.

## Security
For a tool like this, we want to keep you as anonymous as possible; Therefore a few things we do to do this is...
 - Hash user passwords
 - Use random, non predicitive random numbers (at least without getting into true random)
 - Keeping all information locked tightly in the db, but no endpoints (including admins) can see your personal data (email?)
 - We keep limited information, such as your email, and we even use a sudo email if you dont provide a email

## Credits

This project is built with the following open-source packages:

### Dependencies

#### Custom Dependencies
[Disposable email domains](https://github.com/disposable-email-domains/disposable-email-domains)