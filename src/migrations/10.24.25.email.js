async function up(db) {
  // add email (existing) and display_name (new)
  await db.run("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT 'null@austinsdk.me';");
  await db.run("ALTER TABLE users ADD COLUMN display_name TEXT;");

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
}

async function down(db) {
  // To rollback, we need to remove the email and display_name columns
  // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
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
}

module.exports = { up, down };