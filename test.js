const Auth = require('@austinsdk/auth');
const auth = new Auth(
    'http://localhost:3001',        // The auth server URL
    'd8434fdab7bfe45717f137ab94db3377',                   // Your app's client ID
    'c7cbb8887ba8c48ec768a9e7f10352abaff4327cf3e4f3f5d36fb9bbeb9f34d6',               // Your app's client secret (keep this safe!)
    'https://example.com'      // Where users get sent after auth
);
console.log(auth.getAuthUrl())
async function run() {
    console.log(await auth.getUserInfo("cc7a5d3b782d75f08af986fdd1d5497742806c85ff9a079b70e79f5ed728dc42"))
}
run()