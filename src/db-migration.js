const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const colors = require('colors');

(async () => {
  const dbPath = path.join(__dirname, "db/site.db");
  const migrationsDir = path.join(__dirname, "migrations");
  
  console.log('Database path:'.cyan, dbPath);
  console.log('Migrations directory:'.cyan, migrationsDir);

  // Ensure the database file exists
  if (!fs.existsSync(dbPath)) {
    console.error("Database not found at:".red, dbPath);
    return process.exit(1);
  }

  // Ensure migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    console.error("Migrations directory not found at:".red, migrationsDir);
    return process.exit(1);
  }

  const db = new Database(dbPath);

  // Create migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      file_hash TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get all migration files and sort them
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.js'))
    .sort(); // Sorts alphabetically, so 10.24.25.email.js comes before 10.24.26.something.js

  console.log(`\nFound ${migrationFiles.length} migration file(s)`.gray);

  // Helper function to calculate file hash
  function calculateFileHash(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha256').update(fileContent).digest('hex');
  }

  // Get already applied migrations with their hashes
  const appliedMigrations = db.prepare('SELECT name, file_hash FROM migrations').all();
  const appliedMigrationsMap = new Map(appliedMigrations.map(row => [row.name, row.file_hash]));

  let appliedCount = 0;
  let skippedCount = 0;
  let reappliedCount = 0;

  for (const file of migrationFiles) {
    const migrationName = path.basename(file, '.js');
    const migrationPath = path.join(migrationsDir, file);
    const currentHash = calculateFileHash(migrationPath);
    
    const isApplied = appliedMigrationsMap.has(migrationName);
    const storedHash = appliedMigrationsMap.get(migrationName);
    const hashChanged = isApplied && storedHash !== currentHash;
    
    if (isApplied && !hashChanged) {
      console.log(`Skipping '${migrationName}' (already applied, hash matches)`.yellow);
      skippedCount++;
      continue;
    }

    if (hashChanged) {
      console.log(`\nHash changed for '${migrationName}' - reapplying migration...`.magenta);
      console.log(`  Old hash: ${storedHash.substring(0, 16)}...`.gray);
      console.log(`  New hash: ${currentHash.substring(0, 16)}...`.gray);
    } else {
      console.log(`\nApplying migration '${migrationName}'...`.cyan);
    }
    
    try {
      const migration = require(migrationPath);
      
      if (!migration.up || typeof migration.up !== 'function') {
        console.error(`Migration '${migrationName}' missing 'up' function`.red);
        continue;
      }

      // If hash changed and there's a down function, run it first
      if (hashChanged && migration.down && typeof migration.down === 'function') {
        console.log(`  Rolling back previous version...`.gray);
        const dbWrapper = {
          run: (sql) => db.prepare(sql).run(),
          all: (sql) => db.prepare(sql).all(),
          get: (sql) => db.prepare(sql).get()
        };
        await migration.down(dbWrapper);
      }

      // Wrap db operations for the migration
      const dbWrapper = {
        run: (sql) => db.prepare(sql).run(),
        all: (sql) => db.prepare(sql).all(),
        get: (sql) => db.prepare(sql).get()
      };

      await migration.up(dbWrapper);
      
      // Record or update the migration with new hash
      if (hashChanged) {
        db.prepare('UPDATE migrations SET file_hash = ?, applied_at = CURRENT_TIMESTAMP WHERE name = ?')
          .run(currentHash, migrationName);
        console.log(`Migration '${migrationName}' reapplied successfully!`.green);
        reappliedCount++;
      } else {
        db.prepare('INSERT INTO migrations (name, file_hash) VALUES (?, ?)')
          .run(migrationName, currentHash);
        console.log(`Migration '${migrationName}' applied successfully!`.green);
        appliedCount++;
      }
    } catch (error) {
      console.error(`Migration '${migrationName}' failed:`.red, error.message);
      db.close();
      process.exit(1);
    }
  }

  console.log(`\nSummary: ${appliedCount} applied, ${reappliedCount} reapplied, ${skippedCount} skipped`.gray);
  
  db.close();
  console.log('All migrations completed!'.green);
})();
