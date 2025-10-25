const crypto = require('crypto');

async function up(db) {
  console.log('  Migrating users without emails to pseudo-emails...'.gray);
  
  // Get all users without proper emails (null, empty, or default null@austinsdk.me)
  const usersWithoutEmail = db.all(`
    SELECT id, username, email 
    FROM users 
    WHERE email IS NULL 
       OR email = '' 
       OR email = 'null@austinsdk.me'
  `);
  
  console.log(`  Found ${usersWithoutEmail.length} user(s) without proper emails`.gray);
  
  for (const user of usersWithoutEmail) {
    // Generate a random ID (8 characters)
    const randomId = crypto.randomBytes(4).toString('hex');
    const pseudoEmail = `${randomId}@auth.austinsdk.me`;
    
    // Update user's email using template literals for debugging
    await db.run(`UPDATE users SET email = '${pseudoEmail}' WHERE id = ${user.id}`);
    
    // Mark the email as verified since it's a system-generated pseudo-email
    await db.run(`UPDATE users SET email_verified = 1 WHERE id = ${user.id}`);
    
    // Check if there's an existing verification entry for this user
    const existingVerification = await db.get(`
      SELECT id FROM email_verifications 
      WHERE user_id = ${user.id} AND purpose = 'verify_email'
    `);
    
    if (existingVerification) {
      // Update existing verification entry
      await db.run(`
        UPDATE email_verifications 
        SET email = '${pseudoEmail}', 
            verified_at = CURRENT_TIMESTAMP,
            used = 1
        WHERE id = ${existingVerification.id}
      `);
    } else {
      // Create a verification entry marking it as verified
      const verificationToken = crypto.randomBytes(32).toString('hex');
      await db.run(`
        INSERT INTO email_verifications 
        (user_id, email, token, purpose, expires_at, verified_at, used, meta) 
        VALUES (${user.id}, '${pseudoEmail}', '${verificationToken}', 'verify_email', datetime('now', '+1 year'), CURRENT_TIMESTAMP, 1, 'system_generated')
      `);
    }
    
    console.log(`  ✓ User ${user.username} (ID: ${user.id}): ${pseudoEmail} (verified)`.green);
  }
  
  console.log('  Email migration completed!'.green);
}

async function down(db) {
  console.log('  Rolling back email migration...'.gray);
  
  // Find all pseudo-emails that match the pattern
  const pseudoEmailUsers = await db.all(`
    SELECT id, email 
    FROM users 
    WHERE email LIKE '%@auth.austinsdk.me'
  `);
  
  for (const user of pseudoEmailUsers) {
    // Reset to default
    await db.run(`UPDATE users SET email = 'null@austinsdk.me', email_verified = 0 WHERE id = ${user.id}`);
    
    // Remove verification entries for these pseudo-emails
    await db.run(`DELETE FROM email_verifications WHERE user_id = ${user.id} AND meta = 'system_generated'`);
    
    console.log(`  ✓ User ID ${user.id}: reverted to null@austinsdk.me`.yellow);
  }
  
  console.log('  Rollback completed!'.yellow);
}

module.exports = { up, down };
