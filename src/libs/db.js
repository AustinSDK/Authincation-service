const sqlite3 = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const dbDir = path.join(__dirname, '..', 'db');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3(path.join(dbDir, 'site.db'));

const addColumnIfNotExists = (table, column, type) => {
    const stmt = db.prepare(`PRAGMA table_info(${table})`);
    const columns = stmt.all().map(row => row.name);
    if (!columns.includes(column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
};
const migrate = () => {
    db.exec(`

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    permissions TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid INTEGER,
    token TEXT UNIQUE NOT NULL,
    time_stamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT DEFAULT 'no name project' NOT NULL,
    description TEXT DEFAULT 'no description project',
    permissions TEXT DEFAULT '[]' NOT NULL,
    link TEXT DEFAULT '/' NOT NULL,
    time_stamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS oauth_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    client_id TEXT UNIQUE NOT NULL,
    client_secret TEXT NOT NULL,
    redirect_uris TEXT DEFAULT '[]' NOT NULL,
    scopes TEXT DEFAULT '[]' NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    redirect_uri TEXT NOT NULL,
    scope TEXT DEFAULT '',
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES oauth_applications (client_id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    access_token TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    scope TEXT DEFAULT '',
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES oauth_applications (client_id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS totp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    secret TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    active INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL DEFAULT 'verify_email',
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified_at DATETIME,
    used INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    last_sent_at DATETIME,
    ip_address TEXT,
    meta TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(email, purpose)
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);

    `);

    // Add email and email_verified columns to users table if they don't exist
    addColumnIfNotExists('users', 'email', 'TEXT UNIQUE');
    addColumnIfNotExists('users', 'email_verified', 'INTEGER DEFAULT 0');
    
    // Update existing records with null or empty permissions
    try {
        db.prepare("UPDATE users SET permissions = '[]' WHERE permissions IS NULL OR TRIM(permissions) = ''").run();
        db.prepare("UPDATE projects SET permissions = '[]' WHERE permissions IS NULL OR permissions = ''").run();
        
        // Also handle any malformed JSON strings by setting them to empty arrays
        const users = db.prepare("SELECT id, permissions FROM users WHERE permissions != '[]' AND permissions IS NOT NULL AND permissions != ''").all();
        for (const user of users) {
            try {
                JSON.parse(user.permissions);
            } catch (error) {
                console.log(`Fixing malformed permissions for user ${user.id}:`, user.permissions);
                db.prepare("UPDATE users SET permissions = '[]' WHERE id = ?").run(user.id);
            }
        }
        
        const projects = db.prepare("SELECT id, permissions FROM projects WHERE permissions != '[]' AND permissions IS NOT NULL AND permissions != ''").all();
        for (const project of projects) {
            try {
                JSON.parse(project.permissions);
            } catch (error) {
                console.log(`Fixing malformed permissions for project ${project.id}:`, project.permissions);
                db.prepare("UPDATE projects SET permissions = '[]' WHERE id = ?").run(project.id);
            }
        }
    } catch (error) {
        console.log('Note: Some database updates may have failed, this is normal for new databases.');
    }
};

migrate();

// Run migrations automatically after initial migration
(async () => {
    try {
        const migrationsDir = path.join(__dirname, '..', 'migrations');
        
        // Only proceed if migrations directory exists
        if (!fs.existsSync(migrationsDir)) {
            console.log('No migrations directory found, skipping migration scripts.');
            return;
        }

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
            .sort();

        // Helper function to calculate file hash
        function calculateFileHash(filePath) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            return crypto.createHash('sha256').update(fileContent).digest('hex');
        }

        // Get already applied migrations with their hashes
        const appliedMigrations = db.prepare('SELECT name, file_hash FROM migrations').all();
        const appliedMigrationsMap = new Map(appliedMigrations.map(row => [row.name, row.file_hash]));

        let appliedCount = 0;

        for (const file of migrationFiles) {
            const migrationName = path.basename(file, '.js');
            const migrationPath = path.join(migrationsDir, file);
            const currentHash = calculateFileHash(migrationPath);
            
            const isApplied = appliedMigrationsMap.has(migrationName);
            const storedHash = appliedMigrationsMap.get(migrationName);
            const hashChanged = isApplied && storedHash !== currentHash;
            
            // Skip if already applied and hash matches
            if (isApplied && !hashChanged) {
                continue;
            }

            if (hashChanged) {
                console.log(`Hash changed for '${migrationName}' - reapplying migration...`);
            } else {
                console.log(`Applying migration '${migrationName}'...`);
            }
            
            try {
                const migration = require(migrationPath);
                
                if (!migration.up || typeof migration.up !== 'function') {
                    console.error(`Migration '${migrationName}' missing 'up' function`);
                    continue;
                }

                // If hash changed and there's a down function, run it first
                if (hashChanged && migration.down && typeof migration.down === 'function') {
                    const dbWrapper = {
                        run: (sql, params) => {
                            if (params) {
                                return db.prepare(sql).run(...(Array.isArray(params) ? params : [params]));
                            }
                            return db.prepare(sql).run();
                        },
                        all: (sql, params) => {
                            if (params) {
                                return db.prepare(sql).all(...(Array.isArray(params) ? params : [params]));
                            }
                            return db.prepare(sql).all();
                        },
                        get: (sql, params) => {
                            if (params) {
                                return db.prepare(sql).get(...(Array.isArray(params) ? params : [params]));
                            }
                            return db.prepare(sql).get();
                        }
                    };
                    await migration.down(dbWrapper);
                }

                // Wrap db operations for the migration
                const dbWrapper = {
                    run: (sql, params) => {
                        if (params) {
                            return db.prepare(sql).run(...(Array.isArray(params) ? params : [params]));
                        }
                        return db.prepare(sql).run();
                    },
                    all: (sql, params) => {
                        if (params) {
                            return db.prepare(sql).all(...(Array.isArray(params) ? params : [params]));
                        }
                        return db.prepare(sql).all();
                    },
                    get: (sql, params) => {
                        if (params) {
                            return db.prepare(sql).get(...(Array.isArray(params) ? params : [params]));
                        }
                        return db.prepare(sql).get();
                    }
                };

                await migration.up(dbWrapper);
                
                // Record or update the migration with new hash
                if (hashChanged) {
                    db.prepare('UPDATE migrations SET file_hash = ?, applied_at = CURRENT_TIMESTAMP WHERE name = ?')
                        .run(currentHash, migrationName);
                    console.log(`Migration '${migrationName}' reapplied successfully!`);
                } else {
                    db.prepare('INSERT INTO migrations (name, file_hash) VALUES (?, ?)')
                        .run(migrationName, currentHash);
                    console.log(`Migration '${migrationName}' applied successfully!`);
                }
                appliedCount++;
            } catch (error) {
                console.error(`Migration '${migrationName}' failed:`, error.message);
                // Don't exit, just log the error and continue
            }
        }

        if (appliedCount > 0) {
            console.log(`Applied ${appliedCount} migration(s) successfully!`);
        }
    } catch (error) {
        console.error('Error running migrations:', error);
    }
})();

// TOTP helper functions
const totpHelpers = {
    /**
     * Get user's TOTP secret from database
     * @param {number} userId - User ID
     * @returns {object|null} TOTP record or null if not found
     */
    getUserTotpSecret(userId) {
        try {
            return db.prepare('SELECT * FROM totp WHERE user_id = ?').get(userId);
        } catch (error) {
            console.error('Error getting user TOTP secret:', error);
            return null;
        }
    },

    /**
     * Set or update user's TOTP secret
     * @param {number} userId - User ID
     * @param {string} secret - Base32 encoded secret
     * @param {boolean} active - Whether TOTP is active (default: false)
     * @returns {boolean} Success status
     */
    setUserTotpSecret(userId, secret, active = false) {
        try {
            const existing = this.getUserTotpSecret(userId);
            
            if (existing) {
                // Update existing record
                db.prepare('UPDATE totp SET secret = ?, active = ?, created_at = CURRENT_TIMESTAMP WHERE user_id = ?')
                    .run(secret, active ? 1 : 0, userId);
            } else {
                // Insert new record
                db.prepare('INSERT INTO totp (user_id, secret, active) VALUES (?, ?, ?)')
                    .run(userId, secret, active ? 1 : 0);
            }
            return true;
        } catch (error) {
            console.error('Error setting user TOTP secret:', error);
            return false;
        }
    },

    /**
     * Activate TOTP for a user
     * @param {number} userId - User ID
     * @returns {boolean} Success status
     */
    activateTotpForUser(userId) {
        try {
            db.prepare('UPDATE totp SET active = 1 WHERE user_id = ?').run(userId);
            return true;
        } catch (error) {
            console.error('Error activating TOTP for user:', error);
            return false;
        }
    },

    /**
     * Deactivate TOTP for a user
     * @param {number} userId - User ID
     * @returns {boolean} Success status
     */
    deactivateTotpForUser(userId) {
        try {
            db.prepare('UPDATE totp SET active = 0 WHERE user_id = ?').run(userId);
            return true;
        } catch (error) {
            console.error('Error deactivating TOTP for user:', error);
            return false;
        }
    },

    /**
     * Delete user's TOTP secret
     * @param {number} userId - User ID
     * @returns {boolean} Success status
     */
    deleteTotpForUser(userId) {
        try {
            db.prepare('DELETE FROM totp WHERE user_id = ?').run(userId);
            return true;
        } catch (error) {
            console.error('Error deleting TOTP for user:', error);
            return false;
        }
    }
};

// Attach helpers to db object
db.totp = totpHelpers;

module.exports = db