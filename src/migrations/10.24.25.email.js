async function up(db) {
  await db.run("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT 'null@austinsdk.me';");
}

async function down(db) {
  // To rollback, we need to remove the email column
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