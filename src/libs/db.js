const sqlite3 = require("better-sqlite3");
const path = require("path");

const db = new sqlite3(path.join(__dirname,'..','db','site.db'))

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
    name TEXT DEFAULT "no name project" NOT NULL,
    description TEXT DEFAULT "no description project",
    permissions TEXT DEFAULT '[]' NOT NULL,
    link TEXT DEFAULT "/" NOT NULL,
    time_stamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
    `);
    
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

module.exports = db