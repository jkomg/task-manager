import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import db from './db.js';
import { buildDefaultState, normalizeState } from './defaultState.js';

const app = express();
const PORT = 3001;
const SESSION_COOKIE = 'focus_flow_session';
const WEATHER_CODE_LABELS = {
  0: 'clear',
  1: 'mostly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'foggy',
  48: 'foggy',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  56: 'freezing drizzle',
  57: 'freezing drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'freezing rain',
  67: 'freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'rain showers',
  81: 'rain showers',
  82: 'heavy rain showers',
  85: 'snow showers',
  86: 'snow showers',
  95: 'thunderstorms',
  96: 'thunderstorms with hail',
  99: 'thunderstorms with hail',
};

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

function getTimeDetails(timeZone) {
  const safeTimeZone = timeZone || 'UTC';
  const now = new Date();
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTimeZone,
      hour: '2-digit',
      hour12: false,
      weekday: 'long',
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      hour12: false,
      weekday: 'long',
    });
  }
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '12');
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';

  let period = 'evening';
  if (hour >= 5 && hour < 12) {
    period = 'morning';
  } else if (hour >= 12 && hour < 17) {
    period = 'afternoon';
  }

  return { hour, weekday, period };
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

app.get('/api/context/brief', requireAuth, async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  const persisted = normalizeState(JSON.parse(req.user.settings_json));
  const timeZone = String(req.query.timeZone ?? req.query.tz ?? persisted.preferences?.timeZone ?? 'UTC');
  const timeDetails = getTimeDetails(timeZone);

  // Default to Fredericksburg, VA when no location provided
  const effectiveLat = Number.isFinite(latitude) ? latitude : 38.3032;
  const effectiveLon = Number.isFinite(longitude) ? longitude : -77.4605;

  const query = new URLSearchParams({
    latitude: String(effectiveLat),
    longitude: String(effectiveLon),
    timezone: timeZone,
    current: 'temperature_2m,weather_code,uv_index,is_day',
    daily: 'sunrise,sunset,uv_index_max',
  });

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`weather upstream ${response.status}`);
    }

    const payload = await response.json();
    const weatherCode = Number(payload?.current?.weather_code);
    const uvNow = Number(payload?.current?.uv_index);
    const uvMax = Number(payload?.daily?.uv_index_max?.[0]);

    let lightSuggestion = 'A short outdoor light break can help stabilize attention.';
    if (Number.isFinite(uvNow) && uvNow < 2) {
      lightSuggestion = 'UV is low right now; prioritize bright outdoor light for circadian support.';
    }
    if (Number.isFinite(uvNow) && uvNow >= 6) {
      lightSuggestion = 'UV is strong; a brief light break is still useful but avoid long direct exposure.';
    }

    return res.json({
      timeZone,
      ...timeDetails,
      weather: {
        temperatureC: Number(payload?.current?.temperature_2m),
        code: weatherCode,
        summary: WEATHER_CODE_LABELS[weatherCode] ?? 'mixed conditions',
        isDay: Boolean(payload?.current?.is_day),
        uvNow: Number.isFinite(uvNow) ? uvNow : null,
        uvMax: Number.isFinite(uvMax) ? uvMax : null,
        sunrise: payload?.daily?.sunrise?.[0] ?? null,
        sunset: payload?.daily?.sunset?.[0] ?? null,
        lightSuggestion,
      },
    });
  } catch {
    return res.json({
      timeZone,
      ...timeDetails,
      weather: null,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Focus Flow API listening on http://localhost:${PORT}`);
});
