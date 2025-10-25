const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const colors = require('colors');

(async () => {
  const dbPath = path.join(__dirname, "db/site.db");
  
  console.log('Database path:'.cyan, dbPath);

  if (!fs.existsSync(dbPath)) {
    console.error("Database not found at:".red, dbPath);
    return process.exit(1);
  }

  const db = new Database(dbPath);

  console.log('\nCleaning up failed migration state...'.yellow);

  try {
    // Drop the temporary table if it exists
    console.log('  Dropping users_temp table (if exists)...'.gray);
    db.exec('DROP TABLE IF EXISTS users_temp;');
    console.log('  ✓ Done'.green);

    // Delete the migration record for 10.24.25.email so it can be reapplied
    console.log('  Removing migration record for 10.24.25.email...'.gray);
    db.prepare('DELETE FROM migrations WHERE name = ?').run('10.24.25.email');
    console.log('  ✓ Done'.green);

    // Delete the migration record for 10.24.25.migrate-emails
    console.log('  Removing migration record for 10.24.25.migrate-emails...'.gray);
    db.prepare('DELETE FROM migrations WHERE name = ?').run('10.24.25.migrate-emails');
    console.log('  ✓ Done'.green);

    console.log('\nCleanup completed!'.green);
    console.log('You can now run "npm run migrate" again.'.cyan);

  } catch (error) {
    console.error('Cleanup failed:'.red, error.message);
    process.exit(1);
  } finally {
    db.close();
  }
})();
