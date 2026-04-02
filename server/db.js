import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dataDir = path.resolve('data');
const dbPath = path.join(dataDir, 'focus-flow.db');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_FEATURE_FLAGS = [
  { key: 'daily_check_in', enabled: 1, description: 'Show the daily wake-time and body-state check-in flow.' },
  { key: 'mind_context', enabled: 1, description: 'Show weather, circadian context, and related recommendations.' },
  { key: 'cycle_tracking', enabled: 1, description: 'Allow cycle tracking and cycle-aware recommendations.' },
  { key: 'task_timers', enabled: 1, description: 'Allow per-task nested timers inside phases.' },
  { key: 'proactive_suggestions', enabled: 1, description: 'Show proactive task recommendations after check-in.' },
];

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
    role TEXT NOT NULL DEFAULT 'user',
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

  CREATE TABLE IF NOT EXISTS feature_flags (
    key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    description TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    updated_by_user_id TEXT,
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'info',
    actor_user_id TEXT,
    target_user_id TEXT,
    request_id TEXT,
    message TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
  );
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all();
const sessionColumns = db.prepare('PRAGMA table_info(sessions)').all();

if (!userColumns.some((column) => column.name === 'role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
}

if (!sessionColumns.some((column) => column.name === 'expires_at')) {
  db.exec('ALTER TABLE sessions ADD COLUMN expires_at TEXT');
  db.prepare('UPDATE sessions SET expires_at = ? WHERE expires_at IS NULL')
    .run(new Date(Date.now() + SESSION_TTL_MS).toISOString());
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);
  CREATE INDEX IF NOT EXISTS idx_audit_events_actor_user_id ON audit_events(actor_user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_events_target_user_id ON audit_events(target_user_id);
`);

const upsertFeatureFlag = db.prepare(`
  INSERT INTO feature_flags (key, enabled, description, updated_at, updated_by_user_id)
  VALUES (@key, @enabled, @description, @updated_at, NULL)
  ON CONFLICT(key) DO UPDATE SET
    description = excluded.description
`);

const nowIso = new Date().toISOString();
for (const flag of DEFAULT_FEATURE_FLAGS) {
  upsertFeatureFlag.run({ ...flag, updated_at: nowIso });
}

export default db;
