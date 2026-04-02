import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dataDir = path.resolve('data');
const dbPath = path.join(dataDir, 'focus-flow.db');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    settings_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const sessionColumns = db.prepare('PRAGMA table_info(sessions)').all();

if (!sessionColumns.some((column) => column.name === 'expires_at')) {
  db.exec('ALTER TABLE sessions ADD COLUMN expires_at TEXT');
  db.prepare('UPDATE sessions SET expires_at = ? WHERE expires_at IS NULL')
    .run(new Date(Date.now() + SESSION_TTL_MS).toISOString());
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
`);

export default db;
