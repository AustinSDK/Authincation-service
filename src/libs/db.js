const sqlite3 = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbDir = path.join(__dirname, '..', 'db');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3(path.join(dbDir, 'site.db'));

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
    permissions DEFAULT "austin" NOT NULL,
    link TEXT DEFAULT "/" NOT NULL,
    time_stamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
    `);

};

migrate();


module.exports = db