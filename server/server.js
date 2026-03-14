import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import db from './db.js';
import { buildDefaultState, normalizeState } from './defaultState.js';

const app = express();
const PORT = 3001;
const SESSION_COOKIE = 'focus_flow_session';

app.use(express.json({ limit: '1mb' }));

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf('=');
        const key = separatorIndex >= 0 ? part.slice(0, separatorIndex) : part;
        const value = separatorIndex >= 0 ? part.slice(separatorIndex + 1) : '';
        return [key, decodeURIComponent(value)];
      })
  );
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
  };
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const row = db
    .prepare(
      `SELECT users.id, users.email, users.display_name, users.settings_json
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?`
    )
    .get(token);

  if (!row) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Session expired.' });
  }

  req.user = row;
  req.sessionToken = token;
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/register', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const displayName = String(req.body?.displayName ?? '').trim();

  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account already exists for that email.' });
  }

  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);
  const settings = JSON.stringify(buildDefaultState());

  db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, settings_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, email, passwordHash, displayName, settings, new Date().toISOString());

  const token = crypto.randomUUID();
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
    .run(token, id, new Date().toISOString());

  setSessionCookie(res, token);

  const user = db
    .prepare('SELECT id, email, display_name FROM users WHERE id = ?')
    .get(id);

  return res.status(201).json({
    user: publicUser(user),
    settings: JSON.parse(settings),
  });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  const user = db
    .prepare('SELECT id, email, display_name, password_hash, settings_json FROM users WHERE email = ?')
    .get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = crypto.randomUUID();
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
    .run(token, user.id, new Date().toISOString());

  setSessionCookie(res, token);

  return res.json({
    user: publicUser(user),
    settings: normalizeState(JSON.parse(user.settings_json)),
  });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
  clearSessionCookie(res);
  res.status(204).end();
});

app.get('/api/auth/session', requireAuth, (req, res) => {
  res.json({
    user: publicUser(req.user),
    settings: normalizeState(JSON.parse(req.user.settings_json)),
  });
});

app.put('/api/settings', requireAuth, (req, res) => {
  const nextState = normalizeState(req.body);

  db.prepare('UPDATE users SET settings_json = ? WHERE id = ?')
    .run(JSON.stringify(nextState), req.user.id);

  res.json({ settings: nextState });
});

app.listen(PORT, () => {
  console.log(`Focus Flow API listening on http://localhost:${PORT}`);
});
