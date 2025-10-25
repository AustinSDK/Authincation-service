async function up(db) {
  // Check which columns already exist
  const tableInfo = await db.all("PRAGMA table_info(users)");
  const columnNames = tableInfo.map(col => col.name);
  
  // Add columns only if they don't exist
  if (!columnNames.includes('email')) {
    await db.run("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT 'null@austinsdk.me';");
  }
  
  if (!columnNames.includes('display_name')) {
    await db.run("ALTER TABLE users ADD COLUMN display_name TEXT;");
  }
  
  if (!columnNames.includes('email_verified')) {
    await db.run("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;");
  }

  // populate display_name for existing rows
  await db.run("UPDATE users SET display_name = username WHERE display_name IS NULL;");

  // ensure future inserts get display_name = username when no display_name provided
  await db.run(`
    CREATE TRIGGER IF NOT EXISTS users_set_display_name_after_insert
    AFTER INSERT ON users
    WHEN NEW.display_name IS NULL
    BEGIN
      UPDATE users SET display_name = NEW.username WHERE id = NEW.id;
    END;
  `);

  // create email_verifications table
  await db.run(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      purpose TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      verified_at DATETIME,
      used INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      last_sent_at DATETIME,
      ip_address TEXT,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

async function down(db) {
  // Drop the email_verifications table first to avoid foreign key constraints
  await db.run('DROP TABLE IF EXISTS email_verifications;');
  
  // To rollback, we need to remove the email, display_name and email_verified columns
  // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
  
  // Clean up any leftover temp table from previous failed attempts
  await db.run('DROP TABLE IF EXISTS users_temp;');
  
  // Disable foreign key constraints temporarily
  await db.run('PRAGMA foreign_keys = OFF;');
  
  await db.run('CREATE TABLE users_temp AS SELECT id, username, password, permissions, created_at FROM users;');
  await db.run('DROP TABLE users;');
  await db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      permissions TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await db.run('INSERT INTO users (id, username, password, permissions, created_at) SELECT id, username, password, permissions, created_at FROM users_temp;');
  await db.run('DROP TABLE users_temp;');
  
  // Re-enable foreign key constraints
  await db.run('PRAGMA foreign_keys = ON;');
}

module.exports = { up, down };