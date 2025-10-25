async function up(db) {
  // Check which columns exist in email_verifications table
  const tableInfo = await db.all("PRAGMA table_info(email_verifications)");
  const columnNames = tableInfo.map(col => col.name);
  
  // Add missing columns if they don't exist
  if (!columnNames.includes('sent_count')) {
    await db.run("ALTER TABLE email_verifications ADD COLUMN sent_count INTEGER NOT NULL DEFAULT 0;");
    console.log('Added sent_count column to email_verifications');
  }
  
  if (!columnNames.includes('last_sent_at')) {
    await db.run("ALTER TABLE email_verifications ADD COLUMN last_sent_at DATETIME;");
    console.log('Added last_sent_at column to email_verifications');
  }
  
  if (!columnNames.includes('ip_address')) {
    await db.run("ALTER TABLE email_verifications ADD COLUMN ip_address TEXT;");
    console.log('Added ip_address column to email_verifications');
  }
  
  console.log('Migration 10.25.25.fix-email-verifications completed successfully');
}

async function down(db) {
  // SQLite doesn't support DROP COLUMN directly in older versions
  // We would need to recreate the table to remove columns
  // For safety, we'll leave this as a no-op since removing columns could cause data loss
  console.log('Rollback for this migration is not supported (columns will remain)');
}

module.exports = { up, down };
