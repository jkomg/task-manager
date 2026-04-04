import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const DEFAULT_DATA_DIR = path.resolve('data');
const DEFAULT_DB_PATH = path.join(DEFAULT_DATA_DIR, 'focus-flow.db');

const DEFAULT_FEATURE_FLAGS = [
  { key: 'daily_check_in', enabled: 1, description: 'Show the daily wake-time and body-state check-in flow.' },
  { key: 'mind_context', enabled: 1, description: 'Show weather, circadian context, and related recommendations.' },
  { key: 'cycle_tracking', enabled: 1, description: 'Allow cycle tracking and cycle-aware recommendations.' },
  { key: 'task_timers', enabled: 1, description: 'Allow per-task nested timers inside phases.' },
  { key: 'proactive_suggestions', enabled: 1, description: 'Show proactive task recommendations after check-in.' },
];

const USERS_TABLE_BODY = `
  (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    auth_provider TEXT NOT NULL DEFAULT 'local',
    auth_subject TEXT NOT NULL,
    account_status TEXT NOT NULL DEFAULT 'active',
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    last_failed_login_at TEXT,
    locked_until TEXT,
    settings_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_login_at TEXT
  )
`;

const SESSIONS_TABLE_BODY = `
  (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

const FEATURE_FLAGS_TABLE_BODY = `
  (
    key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    description TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    updated_by_user_id TEXT,
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  )
`;

const AUDIT_EVENTS_TABLE_BODY = `
  (
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
  )
`;

function getTableColumns(db, tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all();
}

function computeSessionExpiry(createdAt) {
  const createdAtMs = Number.isFinite(Date.parse(createdAt)) ? Date.parse(createdAt) : Date.now();
  return new Date(createdAtMs + SESSION_TTL_MS).toISOString();
}

function legacyUsersTableExists(db) {
  return Boolean(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users_legacy'").get()
  );
}

function rebuildUsersTableIfNeeded(db) {
  const userColumns = getTableColumns(db, 'users');
  const columnNames = new Set(userColumns.map((column) => column.name));
  const passwordHashColumn = userColumns.find((column) => column.name === 'password_hash');
  const needsRebuild =
    !columnNames.has('auth_provider') ||
    !columnNames.has('auth_subject') ||
    !columnNames.has('account_status') ||
    !columnNames.has('failed_login_attempts') ||
    !columnNames.has('last_failed_login_at') ||
    !columnNames.has('locked_until') ||
    !columnNames.has('last_login_at') ||
    passwordHashColumn?.notnull === 1;

  if (!needsRebuild) {
    return;
  }

  const roleExpression = columnNames.has('role') ? "COALESCE(role, 'user')" : "'user'";
  const authProviderExpression = columnNames.has('auth_provider') ? "COALESCE(auth_provider, 'local')" : "'local'";
  const authSubjectExpression = columnNames.has('auth_subject')
    ? "COALESCE(auth_subject, email, id)"
    : "COALESCE(email, id)";
  const accountStatusExpression = columnNames.has('account_status')
    ? "COALESCE(account_status, 'active')"
    : "'active'";
  const failedAttemptsExpression = columnNames.has('failed_login_attempts')
    ? 'COALESCE(failed_login_attempts, 0)'
    : '0';
  const lastFailedLoginExpression = columnNames.has('last_failed_login_at') ? 'last_failed_login_at' : 'NULL';
  const lockedUntilExpression = columnNames.has('locked_until') ? 'locked_until' : 'NULL';
  const lastLoginExpression = columnNames.has('last_login_at') ? 'last_login_at' : 'NULL';
  const passwordHashExpression = columnNames.has('password_hash') ? 'password_hash' : 'NULL';

  const migrateUsers = db.transaction(() => {
    db.pragma('foreign_keys = OFF');
    db.exec('ALTER TABLE users RENAME TO users_legacy');
    db.exec(`CREATE TABLE users ${USERS_TABLE_BODY}`);
    db.exec(`
      INSERT INTO users (
        id,
        email,
        password_hash,
        display_name,
        role,
        auth_provider,
        auth_subject,
        account_status,
        failed_login_attempts,
        last_failed_login_at,
        locked_until,
        settings_json,
        created_at,
        last_login_at
      )
      SELECT
        id,
        email,
        ${passwordHashExpression},
        display_name,
        ${roleExpression},
        ${authProviderExpression},
        ${authSubjectExpression},
        ${accountStatusExpression},
        ${failedAttemptsExpression},
        ${lastFailedLoginExpression},
        ${lockedUntilExpression},
        settings_json,
        created_at,
        ${lastLoginExpression}
      FROM users_legacy
    `);
    db.pragma('foreign_keys = ON');
  });

  migrateUsers();
}

function tableReferencesLegacyUsers(db, tableName) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  return row?.sql?.includes('users_legacy') ?? false;
}

function rebuildUserForeignKeyTablesIfNeeded(db) {
  const rebuildSessions = tableReferencesLegacyUsers(db, 'sessions');
  const rebuildFeatureFlags = tableReferencesLegacyUsers(db, 'feature_flags');
  const rebuildAuditEvents = tableReferencesLegacyUsers(db, 'audit_events');

  if (!rebuildSessions && !rebuildFeatureFlags && !rebuildAuditEvents) {
    return;
  }

  const sessionColumnNames = new Set(getTableColumns(db, 'sessions').map((column) => column.name));
  const sessionExpiresExpression = sessionColumnNames.has('expires_at') ? 'expires_at' : 'NULL';

  const rebuildTables = db.transaction(() => {
    db.pragma('foreign_keys = OFF');

    if (rebuildSessions) {
      db.exec(`CREATE TABLE sessions_new ${SESSIONS_TABLE_BODY}`);
      db.exec(`
        INSERT INTO sessions_new (token, user_id, created_at, expires_at)
        SELECT token, user_id, created_at, ${sessionExpiresExpression}
        FROM sessions
      `);
      db.exec('DROP TABLE sessions');
      db.exec('ALTER TABLE sessions_new RENAME TO sessions');
    }

    if (rebuildFeatureFlags) {
      db.exec(`CREATE TABLE feature_flags_new ${FEATURE_FLAGS_TABLE_BODY}`);
      db.exec(`
        INSERT INTO feature_flags_new (key, enabled, description, updated_at, updated_by_user_id)
        SELECT key, enabled, description, updated_at, updated_by_user_id
        FROM feature_flags
      `);
      db.exec('DROP TABLE feature_flags');
      db.exec('ALTER TABLE feature_flags_new RENAME TO feature_flags');
    }

    if (rebuildAuditEvents) {
      db.exec(`CREATE TABLE audit_events_new ${AUDIT_EVENTS_TABLE_BODY}`);
      db.exec(`
        INSERT INTO audit_events_new (
          id, event_type, level, actor_user_id, target_user_id, request_id, message, metadata_json, created_at
        )
        SELECT
          id, event_type, level, actor_user_id, target_user_id, request_id, message, metadata_json, created_at
        FROM audit_events
      `);
      db.exec('DROP TABLE audit_events');
      db.exec('ALTER TABLE audit_events_new RENAME TO audit_events');
    }

    db.pragma('foreign_keys = ON');
  });

  rebuildTables();
}

function dropLegacyUsersTableIfPresent(db) {
  if (!legacyUsersTableExists(db)) {
    return;
  }

  const dropLegacyUsersTable = db.transaction(() => {
    db.pragma('foreign_keys = OFF');
    db.exec('DROP TABLE users_legacy');
    db.pragma('foreign_keys = ON');
  });

  dropLegacyUsersTable();
}

function ensureSessionExpiryColumn(db) {
  const sessionColumns = getTableColumns(db, 'sessions');
  if (!sessionColumns.some((column) => column.name === 'expires_at')) {
    db.exec('ALTER TABLE sessions ADD COLUMN expires_at TEXT');
  }

  const sessionsMissingExpiry = db
    .prepare('SELECT token, created_at FROM sessions WHERE expires_at IS NULL')
    .all();

  if (sessionsMissingExpiry.length === 0) {
    return;
  }

  const updateSessionExpiry = db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?');
  const backfillSessionExpiry = db.transaction((rows) => {
    for (const row of rows) {
      updateSessionExpiry.run(computeSessionExpiry(row.created_at), row.token);
    }
  });

  backfillSessionExpiry(sessionsMissingExpiry);
}

function ensureIndexes(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
    CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_identity ON users(auth_provider, auth_subject);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_events_actor_user_id ON audit_events(actor_user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_target_user_id ON audit_events(target_user_id);
  `);
}

function seedFeatureFlags(db) {
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
}

export function initializeDatabase(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users ${USERS_TABLE_BODY};
    CREATE TABLE IF NOT EXISTS sessions ${SESSIONS_TABLE_BODY};
    CREATE TABLE IF NOT EXISTS feature_flags ${FEATURE_FLAGS_TABLE_BODY};
    CREATE TABLE IF NOT EXISTS audit_events ${AUDIT_EVENTS_TABLE_BODY};
  `);

  rebuildUsersTableIfNeeded(db);
  rebuildUserForeignKeyTablesIfNeeded(db);
  dropLegacyUsersTableIfPresent(db);
  ensureSessionExpiryColumn(db);
  ensureIndexes(db);
  seedFeatureFlags(db);

  return db;
}

export function createDatabase(dbPath = DEFAULT_DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  return initializeDatabase(db);
}

const db = createDatabase();

export default db;
