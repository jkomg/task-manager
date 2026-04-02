import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDatabase } from '../server/db.js';
import { createApp } from '../server/createApp.js';

function createTempDbPath(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  return path.join(root, 'data', 'focus-flow.db');
}

function readCookie(setCookieHeader) {
  return String(setCookieHeader ?? '').split(';')[0];
}

async function startTestServer({ name, adminEmails = [] } = {}) {
  const dbPath = createTempDbPath(name ?? 'focusflow-api');
  const db = createDatabase(dbPath);
  const app = createApp({
    db,
    adminEmails,
    log: () => {},
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          current: {
            temperature_2m: 20,
            weather_code: 1,
            uv_index: 2,
            is_day: 1,
          },
          daily: {
            sunrise: ['2026-04-01T06:45'],
            sunset: ['2026-04-01T19:20'],
            uv_index_max: [5],
          },
        };
      },
    }),
  });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function request(url, options = {}) {
    const response = await fetch(`${baseUrl}${url}`, options);
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    return { response, body };
  }

  async function close() {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    db.close();
  }

  return { db, request, close };
}

test('registers a user and restores the session via cookie', async () => {
  const server = await startTestServer({ name: 'focusflow-auth-session' });
  try {
    const registration = await server.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Alex',
        email: 'alex@example.com',
        password: 'longenoughpassword',
      }),
    });

    assert.equal(registration.response.status, 201);
    assert.equal(registration.body.user.email, 'alex@example.com');
    assert.equal(registration.body.auth.mode, 'local');

    const cookie = readCookie(registration.response.headers.get('set-cookie'));
    assert.ok(cookie.startsWith('focus_flow_session='));

    const session = await server.request('/api/auth/session', {
      headers: { cookie },
    });

    assert.equal(session.response.status, 200);
    assert.equal(session.body.user.displayName, 'Alex');
    assert.equal(session.body.settings.preferences.onboardingComplete, false);
    assert.equal(session.body.auth.passwordSignInEnabled, true);
  } finally {
    await server.close();
  }
});

test('rejects expired sessions and clears the cookie', async () => {
  const server = await startTestServer({ name: 'focusflow-expired-session' });
  try {
    const registration = await server.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Taylor',
        email: 'taylor@example.com',
        password: 'longenoughpassword',
      }),
    });

    const cookie = readCookie(registration.response.headers.get('set-cookie'));
    const token = cookie.split('=')[1];
    server.db
      .prepare('UPDATE sessions SET expires_at = ? WHERE token = ?')
      .run('2000-01-01T00:00:00.000Z', token);

    const session = await server.request('/api/auth/session', {
      headers: { cookie },
    });

    assert.equal(session.response.status, 401);
    assert.equal(session.body.error, 'Session expired.');
    assert.match(String(session.response.headers.get('set-cookie')), /Max-Age=0/);
  } finally {
    await server.close();
  }
});

test('admin reset revokes another user session and resets their state', async () => {
  const server = await startTestServer({
    name: 'focusflow-admin-reset',
    adminEmails: ['admin@example.com'],
  });
  try {
    const adminRegistration = await server.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Admin',
        email: 'admin@example.com',
        password: 'longenoughpassword',
      }),
    });
    const adminCookie = readCookie(adminRegistration.response.headers.get('set-cookie'));
    assert.equal(adminRegistration.body.user.role, 'admin');

    const userRegistration = await server.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Jordan',
        email: 'jordan@example.com',
        password: 'longenoughpassword',
      }),
    });
    const userCookie = readCookie(userRegistration.response.headers.get('set-cookie'));
    const userId = userRegistration.body.user.id;

    server.db
      .prepare("UPDATE users SET settings_json = ? WHERE id = ?")
      .run(JSON.stringify({
        phases: [],
        activePhaseId: null,
        routineType: 'integration',
        healthState: 'drained',
        preferences: {
          setupComplete: true,
          onboardingComplete: true,
        },
      }), userId);

    const reset = await server.request(`/api/admin/users/${userId}/reset`, {
      method: 'POST',
      headers: { cookie: adminCookie },
    });

    assert.equal(reset.response.status, 200);
    assert.equal(reset.body.ok, true);

    const resetUser = server.db
      .prepare('SELECT settings_json FROM users WHERE id = ?')
      .get(userId);
    const parsedState = JSON.parse(resetUser.settings_json);
    assert.equal(parsedState.routineType, 'session');
    assert.equal(parsedState.preferences.setupComplete, false);

    const revokedSession = await server.request('/api/auth/session', {
      headers: { cookie: userCookie },
    });
    assert.equal(revokedSession.response.status, 401);
  } finally {
    await server.close();
  }
});

test('admin can suspend and reactivate accounts', async () => {
  const server = await startTestServer({
    name: 'focusflow-admin-account-status',
    adminEmails: ['admin@example.com'],
  });
  try {
    const adminRegistration = await server.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Admin',
        email: 'admin@example.com',
        password: 'longenoughpassword',
      }),
    });
    const adminCookie = readCookie(adminRegistration.response.headers.get('set-cookie'));

    const userRegistration = await server.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Jordan',
        email: 'jordan@example.com',
        password: 'longenoughpassword',
      }),
    });
    const userCookie = readCookie(userRegistration.response.headers.get('set-cookie'));
    const userId = userRegistration.body.user.id;

    const suspendResponse = await server.request(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookie,
      },
      body: JSON.stringify({ accountStatus: 'suspended' }),
    });
    assert.equal(suspendResponse.response.status, 200);
    assert.equal(suspendResponse.body.user.accountStatus, 'suspended');
    assert.equal(suspendResponse.body.changed, true);
    assert.equal(suspendResponse.body.revokedSessions, 1);

    const revokedSession = await server.request('/api/auth/session', {
      headers: { cookie: userCookie },
    });
    assert.equal(revokedSession.response.status, 401);

    const reactivateResponse = await server.request(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookie,
      },
      body: JSON.stringify({ accountStatus: 'active' }),
    });
    assert.equal(reactivateResponse.response.status, 200);
    assert.equal(reactivateResponse.body.user.accountStatus, 'active');

    const loginAgain = await server.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'jordan@example.com',
        password: 'longenoughpassword',
      }),
    });
    assert.equal(loginAgain.response.status, 200);
  } finally {
    await server.close();
  }
});

test('admin can inspect users and revoke sessions while preserving current admin session', async () => {
  const server = await startTestServer({
    name: 'focusflow-admin-inspect-revoke',
    adminEmails: ['admin@example.com'],
  });
  try {
    const adminRegistration = await server.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Admin',
        email: 'admin@example.com',
        password: 'longenoughpassword',
      }),
    });
    const adminCookie = readCookie(adminRegistration.response.headers.get('set-cookie'));

    const userRegistration = await server.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Taylor',
        email: 'taylor@example.com',
        password: 'longenoughpassword',
      }),
    });
    const userId = userRegistration.body.user.id;

    const inspect = await server.request(`/api/admin/users/${userId}`, {
      headers: { cookie: adminCookie },
    });
    assert.equal(inspect.response.status, 200);
    assert.equal(inspect.body.user.email, 'taylor@example.com');
    assert.equal(inspect.body.activeSessionCount, 1);
    assert.equal(inspect.body.plannerStateSummary.phaseCount > 0, true);
    assert.equal(Array.isArray(inspect.body.sessions), true);

    const revokeOwnSessions = await server.request(`/api/admin/users/${adminRegistration.body.user.id}/revoke-sessions`, {
      method: 'POST',
      headers: { cookie: adminCookie },
    });
    assert.equal(revokeOwnSessions.response.status, 200);
    assert.equal(revokeOwnSessions.body.ok, true);
    assert.equal(revokeOwnSessions.body.preservedCurrentSession, true);

    const adminStillAuthed = await server.request('/api/auth/session', {
      headers: { cookie: adminCookie },
    });
    assert.equal(adminStillAuthed.response.status, 200);

    const summary = await server.request('/api/admin/summary', {
      headers: { cookie: adminCookie },
    });
    assert.equal(summary.response.status, 200);
    assert.equal(typeof summary.body.metrics.suspendedUsers, 'number');
  } finally {
    await server.close();
  }
});
