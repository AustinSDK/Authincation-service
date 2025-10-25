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

| Package | Version |
|---------|----------|
| [@austinsdk/auth](https://www.npmjs.com/package/@austinsdk/auth) | ^1.1.1 |
| [argon2](https://www.npmjs.com/package/argon2) | ^0.44.0 |
| [bcryptjs](https://www.npmjs.com/package/bcryptjs) | ^3.0.2 |
| [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) | ^12.2.0 |
| [colors](https://www.npmjs.com/package/colors) | ^1.4.0 |
| [cookie-parser](https://www.npmjs.com/package/cookie-parser) | ^1.4.7 |
| [dotenv](https://www.npmjs.com/package/dotenv) | ^17.2.1 |
| [ejs](https://www.npmjs.com/package/ejs) | ^3.1.10 |
| [express](https://www.npmjs.com/package/express) | ^5.1.0 |
| [express-rate-limit](https://www.npmjs.com/package/express-rate-limit) | ^8.0.1 |
| [form-data](https://www.npmjs.com/package/form-data) | ^4.0.4 |
| [joi](https://www.npmjs.com/package/joi) | ^18.0.1 |
| [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) | ^9.0.2 |
| [mailgun.js](https://www.npmjs.com/package/mailgun.js) | ^12.1.1 |
| [sqlite-auto-migrator](https://www.npmjs.com/package/sqlite-auto-migrator) | ^1.3.1 |
| [sqlite3](https://www.npmjs.com/package/sqlite3) | ^5.1.7 |