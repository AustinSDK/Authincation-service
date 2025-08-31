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
    permissions,
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
    permissions DEFAULT "austin" NOT NULL,
    link TEXT DEFAULT "/" NOT NULL,
    time_stamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
    `);
};
migrate();

module.exports = db