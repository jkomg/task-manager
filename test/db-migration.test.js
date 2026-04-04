import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const dbModuleUrl = pathToFileURL(path.join(repoRoot, 'server', 'db.js')).href;

function importDbModuleIn(workdir) {
  execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `import(${JSON.stringify(dbModuleUrl)}).then(() => console.log('ok'))`],
    {
      cwd: workdir,
      env: process.env,
      encoding: 'utf8',
    }
  );
}

function createTempDb(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'focus-flow.db');
  return { root, dbPath };
}

test('migrates a direct legacy database with sessions missing expires_at', () => {
  const { root, dbPath } = createTempDb('focusflow-legacy-direct');
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      settings_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE feature_flags (
      key TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      updated_by_user_id TEXT,
      FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE audit_events (
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
    INSERT INTO users (id, email, password_hash, display_name, settings_json, created_at)
    VALUES ('user-1', 'alex@example.com', 'hash', 'Alex', '{}', '2026-01-01T00:00:00.000Z');
    INSERT INTO sessions (token, user_id, created_at)
    VALUES ('session-1', 'user-1', '2026-01-01T00:00:00.000Z');
  `);
  db.close();

  importDbModuleIn(root);

  const migrated = new Database(dbPath, { readonly: true });
  const userColumns = migrated.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
  const sessionColumns = migrated.prepare('PRAGMA table_info(sessions)').all().map((column) => column.name);
  const tableSql = migrated
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name IN ('sessions', 'feature_flags', 'audit_events')")
    .all()
    .map((row) => row.sql)
    .join('\n');

  assert.deepEqual(
    userColumns,
    [
      'id',
      'email',
      'password_hash',
      'display_name',
      'role',
      'auth_provider',
      'auth_subject',
      'account_status',
      'failed_login_attempts',
      'last_failed_login_at',
      'locked_until',
      'settings_json',
      'created_at',
      'last_login_at',
    ]
  );
  assert.deepEqual(sessionColumns, ['token', 'user_id', 'created_at', 'expires_at']);
  assert.equal(tableSql.includes('users_legacy'), false);
  const migratedSession = migrated.prepare('SELECT created_at, expires_at FROM sessions WHERE token = ?').get('session-1');
  assert.ok(migratedSession.expires_at);
  assert.equal(
    migratedSession.expires_at,
    new Date(Date.parse(migratedSession.created_at) + 1000 * 60 * 60 * 24 * 30).toISOString()
  );
  migrated.close();
});

test('repairs rewritten foreign-key tables even when sessions lacks expires_at', () => {
  const { root, dbPath } = createTempDb('focusflow-legacy-repair');
  const db = new Database(dbPath);
  db.pragma('foreign_keys = OFF');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      auth_provider TEXT NOT NULL DEFAULT 'local',
      auth_subject TEXT NOT NULL,
      account_status TEXT NOT NULL DEFAULT 'active',
      settings_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );
    CREATE TABLE sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users_legacy(id) ON DELETE CASCADE
    );
    CREATE TABLE feature_flags (
      key TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      updated_by_user_id TEXT,
      FOREIGN KEY (updated_by_user_id) REFERENCES users_legacy(id) ON DELETE SET NULL
    );
    CREATE TABLE audit_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      actor_user_id TEXT,
      target_user_id TEXT,
      request_id TEXT,
      message TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (actor_user_id) REFERENCES users_legacy(id) ON DELETE SET NULL,
      FOREIGN KEY (target_user_id) REFERENCES users_legacy(id) ON DELETE SET NULL
    );
    INSERT INTO users (
      id, email, password_hash, display_name, role, auth_provider, auth_subject, account_status, settings_json, created_at, last_login_at
    ) VALUES (
      'user-2', 'sam@example.com', 'hash', 'Sam', 'user', 'local', 'sam@example.com', 'active', '{}', '2026-02-01T00:00:00.000Z', NULL
    );
    INSERT INTO sessions (token, user_id, created_at)
    VALUES ('session-2', 'user-2', '2026-02-01T00:00:00.000Z');
  `);
  db.close();

  importDbModuleIn(root);

  const repaired = new Database(dbPath, { readonly: true });
  const sessionColumns = repaired.prepare('PRAGMA table_info(sessions)').all().map((column) => column.name);
  const tableSql = repaired
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name IN ('sessions', 'feature_flags', 'audit_events')")
    .all()
    .map((row) => row.sql)
    .join('\n');

  assert.deepEqual(sessionColumns, ['token', 'user_id', 'created_at', 'expires_at']);
  assert.equal(tableSql.includes('users_legacy'), false);
  const repairedSession = repaired.prepare('SELECT created_at, expires_at FROM sessions WHERE token = ?').get('session-2');
  assert.ok(repairedSession.expires_at);
  assert.equal(
    repairedSession.expires_at,
    new Date(Date.parse(repairedSession.created_at) + 1000 * 60 * 60 * 24 * 30).toISOString()
  );
  repaired.close();
});
