import crypto from 'node:crypto';
import express from 'express';
import {
  assertPasswordAuthEnabled,
  buildLocalIdentity,
  canUsePasswordAuth,
  getAuthConfig,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from './auth.js';
import { buildDefaultState, normalizeState } from './defaultState.js';
import { SESSION_TTL_MS } from './db.js';

const SESSION_COOKIE = 'focus_flow_session';
const LOGIN_FAILURE_LIMIT = Math.max(1, Number(process.env.LOGIN_FAILURE_LIMIT ?? 5) || 5);
const LOGIN_LOCK_MS = Math.max(60_000, Number(process.env.LOGIN_LOCK_MS ?? 15 * 60 * 1000) || (15 * 60 * 1000));
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

function parseIsoDate(value) {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function getLoginLockState(user, now = new Date()) {
  const lockedUntilDate = parseIsoDate(user?.locked_until);
  if (!lockedUntilDate || lockedUntilDate <= now) {
    return {
      locked: false,
      lockedUntil: null,
      retryAfterSeconds: 0,
    };
  }
  const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntilDate.getTime() - now.getTime()) / 1000));
  return {
    locked: true,
    lockedUntil: lockedUntilDate.toISOString(),
    retryAfterSeconds,
  };
}

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
        try {
          return [key, decodeURIComponent(value)];
        } catch {
          return [key, value];
        }
      })
  );
}

function parseJsonSafely(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function parseStoredSettings(settingsJson) {
  try {
    return normalizeState(JSON.parse(settingsJson));
  } catch {
    return buildDefaultState();
  }
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

export function createApp({
  db,
  adminEmails = String(process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  cookieSecure = process.env.COOKIE_SECURE === 'true',
  fetchImpl = globalThis.fetch,
  log = console.log,
} = {}) {
  const app = express();
  const adminEmailSet = new Set(adminEmails);

  function writeLog(payload) {
    log(JSON.stringify(payload));
  }

  function setSessionCookie(res, token) {
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}; Priority=High${cookieSecure ? '; Secure' : ''}`
    );
  }

  function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${cookieSecure ? '; Secure' : ''}`);
  }

  function publicUser(row) {
    const lockState = getLoginLockState(row);
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      authProvider: row.auth_provider ?? 'local',
      accountStatus: row.account_status ?? 'active',
      failedLoginAttempts: Number(row.failed_login_attempts ?? 0),
      lastFailedLoginAt: row.last_failed_login_at ?? null,
      loginLockedUntil: lockState.locked ? lockState.lockedUntil : null,
    };
  }

  function getUserRole(email, persistedRole = 'user') {
    if (adminEmailSet.has(String(email ?? '').trim().toLowerCase())) {
      return 'admin';
    }
    return persistedRole === 'admin' ? 'admin' : 'user';
  }

  function getFeatureFlags() {
    return db
      .prepare('SELECT key, enabled, description, updated_at, updated_by_user_id FROM feature_flags ORDER BY key')
      .all()
      .map((row) => ({
        key: row.key,
        enabled: Boolean(row.enabled),
        description: row.description,
        updatedAt: row.updated_at,
        updatedByUserId: row.updated_by_user_id,
      }));
  }

  function activeSessionCountForUser(userId, nowIso = new Date().toISOString()) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM sessions
         WHERE user_id = ?
           AND (expires_at IS NULL OR expires_at > ?)`
      )
      .get(userId, nowIso);
    return Number(row?.count ?? 0);
  }

  function plannerStateSummaryForSettings(settingsJson) {
    const settings = parseStoredSettings(settingsJson);
    const phases = Array.isArray(settings?.phases) ? settings.phases : [];
    const totalTasks = phases.reduce((sum, phase) => sum + (Array.isArray(phase.tasks) ? phase.tasks.length : 0), 0);
    const completedTasks = phases.reduce(
      (sum, phase) =>
        sum + (Array.isArray(phase.tasks) ? phase.tasks.filter((task) => task.done).length : 0),
      0
    );
    return {
      routineType: settings?.routineType ?? 'session',
      healthState: settings?.healthState ?? 'steady',
      activePhaseId: settings?.activePhaseId ?? null,
      phaseCount: phases.length,
      totalTasks,
      completedTasks,
      setupComplete: Boolean(settings?.preferences?.setupComplete),
      onboardingComplete: Boolean(settings?.preferences?.onboardingComplete),
      lastResetDate: settings?.preferences?.lastResetDate ?? null,
    };
  }

  function authResponseForUser(user, settingsJson = user.settings_json) {
    const adminCount = Number(
      db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get()?.count ?? 0
    );
    return {
      user: publicUser(user),
      settings: parseStoredSettings(settingsJson),
      featureFlags: getFeatureFlags(),
      auth: getAuthConfig(),
      adminBootstrapEligible:
        getAuthConfig().mode === 'local' &&
        user.role !== 'admin' &&
        adminCount === 0,
    };
  }

  function clearPlannerActivity(settingsJson) {
    const current = parseStoredSettings(settingsJson);
    return normalizeState({
      ...current,
      phases: current.phases.map((phase) => ({
        ...phase,
        tasks: phase.tasks
          .filter((task) => task.type !== 'oneoff')
          .map((task) => ({ ...task, done: false, carryCount: 0 })),
      })),
      healthState: 'steady',
      preferences: {
        ...(current.preferences ?? {}),
        lastResetDate: null,
      },
    });
  }

  function seedDemoPlannerState(settingsJson) {
    const current = parseStoredSettings(settingsJson);
    const dateKey = new Date().toISOString().slice(0, 10);
    const nextPhases = current.phases.map((phase, phaseIndex) => ({
      ...phase,
      tasks: phase.tasks
        .filter((task) => task.type === 'template')
        .map((task, taskIndex) => ({
          ...task,
          done: phaseIndex === 0 ? taskIndex <= 1 : phaseIndex === 1 ? taskIndex === 0 : false,
          carryCount: phaseIndex >= 2 && taskIndex === 0 ? 1 : 0,
        })),
    }));

    if (nextPhases[0]) {
      nextPhases[0].tasks.push({
        id: 'demo-task-inbox-sweep',
        title: 'Inbox sweep (demo)',
        done: false,
        minutes: 12,
        type: 'oneoff',
        carryCount: 0,
      });
    }
    if (nextPhases[1]) {
      nextPhases[1].tasks.push({
        id: 'demo-task-followup-email',
        title: 'Follow-up email block (demo)',
        done: false,
        minutes: 18,
        type: 'oneoff',
        carryCount: 0,
      });
    }

    return normalizeState({
      ...current,
      phases: nextPhases,
      activePhaseId: nextPhases[1]?.id ?? nextPhases[0]?.id ?? current.activePhaseId,
      healthState: 'scattered',
      routineType: 'session',
      preferences: {
        ...(current.preferences ?? {}),
        setupComplete: true,
        onboardingComplete: true,
        goals:
          Array.isArray(current.preferences?.goals) && current.preferences.goals.length > 0
            ? current.preferences.goals
            : ['writing', 'health'],
        lastResetDate: dateKey,
      },
    });
  }

  function writeAuditEvent({
    eventType,
    level = 'info',
    actorUserId = null,
    targetUserId = null,
    requestId = null,
    message,
    metadata = null,
  }) {
    const createdAt = new Date().toISOString();
    const auditId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO audit_events (
        id, event_type, level, actor_user_id, target_user_id, request_id, message, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      auditId,
      eventType,
      level,
      actorUserId,
      targetUserId,
      requestId,
      message,
      metadata ? JSON.stringify(metadata) : null,
      createdAt
    );

    writeLog({
      level,
      type: eventType,
      requestId,
      actorUserId,
      targetUserId,
      message,
      metadata,
    });
  }

  function purgeExpiredSessions(nowIso = new Date().toISOString()) {
    db.prepare('DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at <= ?').run(nowIso);
  }

  function nextSessionExpiry(baseDate = new Date()) {
    return new Date(baseDate.getTime() + SESSION_TTL_MS).toISOString();
  }

  function createSession(userId) {
    const createdAt = new Date();
    const token = crypto.randomUUID();
    db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(token, userId, createdAt.toISOString(), nextSessionExpiry(createdAt));
    return token;
  }

  function refreshSession(token) {
    db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?')
      .run(nextSessionExpiry(), token);
  }

  function recordLoginFailure(userId, now = new Date()) {
    const row = db
      .prepare('SELECT failed_login_attempts, locked_until FROM users WHERE id = ?')
      .get(userId);
    const currentAttempts = Number(row?.failed_login_attempts ?? 0);
    const nextAttempts = currentAttempts + 1;
    const lock = nextAttempts >= LOGIN_FAILURE_LIMIT;
    const lockUntilIso = lock ? new Date(now.getTime() + LOGIN_LOCK_MS).toISOString() : null;

    db.prepare(
      `UPDATE users
       SET failed_login_attempts = ?, last_failed_login_at = ?, locked_until = ?
       WHERE id = ?`
    ).run(lock ? 0 : nextAttempts, now.toISOString(), lockUntilIso, userId);

    return {
      lockApplied: lock,
      lockUntil: lockUntilIso,
      attemptsRemaining: lock ? 0 : Math.max(0, LOGIN_FAILURE_LIMIT - nextAttempts),
    };
  }

  function clearLoginFailures(userId) {
    db.prepare(
      `UPDATE users
       SET failed_login_attempts = 0, last_failed_login_at = NULL, locked_until = NULL
       WHERE id = ?`
    ).run(userId);
  }

  function requireAuth(req, res, next) {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    purgeExpiredSessions();
    const nowIso = new Date().toISOString();
    const row = db
      .prepare(
        `SELECT users.id, users.email, users.display_name, users.role, users.auth_provider, users.auth_subject,
                users.account_status, users.failed_login_attempts, users.last_failed_login_at, users.locked_until, users.settings_json
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token = ?
           AND (sessions.expires_at IS NULL OR sessions.expires_at > ?)`
      )
      .get(token, nowIso);

    if (!row) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Session expired.' });
    }

    if (row.account_status !== 'active') {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      clearSessionCookie(res);
      return res.status(403).json({ error: 'Account access is unavailable.' });
    }

    req.user = row;
    req.sessionToken = token;
    refreshSession(token);
    setSessionCookie(res, token);
    next();
  }

  function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  }

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    const startedAt = Date.now();
    res.on('finish', () => {
      writeLog({
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        type: 'http_request',
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        userId: req.user?.id ?? null,
      });
    });
    next();
  });
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/auth/config', (_req, res) => {
    res.json({ auth: getAuthConfig() });
  });

  app.post('/api/auth/claim-admin', requireAuth, (req, res) => {
    if (getAuthConfig().mode !== 'local') {
      return res.status(403).json({ error: 'Admin bootstrap is disabled for managed auth mode.' });
    }

    const adminCount = Number(
      db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get()?.count ?? 0
    );
    if (adminCount > 0 && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'An admin account already exists. Ask an admin for access.' });
    }

    if (req.user.role !== 'admin') {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(req.user.id);
      req.user.role = 'admin';
      writeAuditEvent({
        eventType: 'auth.admin_bootstrap_claimed',
        level: 'warn',
        actorUserId: req.user.id,
        requestId: req.requestId,
        message: `Admin bootstrap claimed by ${req.user.email}`,
      });
    }

    const user = db
      .prepare(
        'SELECT id, email, display_name, role, auth_provider, auth_subject, account_status, failed_login_attempts, last_failed_login_at, locked_until, settings_json FROM users WHERE id = ?'
      )
      .get(req.user.id);
    return res.json(authResponseForUser(user));
  });

  app.post('/api/auth/register', (req, res) => {
    assertPasswordAuthEnabled();
    const email = normalizeEmail(req.body?.email);
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
    const passwordHash = hashPassword(password);
    const settings = JSON.stringify(buildDefaultState());
    const role = getUserRole(email);
    const identity = buildLocalIdentity(email);

    db.prepare(
      `INSERT INTO users (
        id, email, password_hash, display_name, role, auth_provider, auth_subject, account_status, settings_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, email, passwordHash, displayName, role, identity.authProvider, identity.authSubject, 'active', settings, new Date().toISOString());

    const token = createSession(id);
    setSessionCookie(res, token);

    const user = db
      .prepare(
        'SELECT id, email, display_name, role, auth_provider, auth_subject, account_status, failed_login_attempts, last_failed_login_at, locked_until, settings_json FROM users WHERE id = ?'
      )
      .get(id);

    writeAuditEvent({
      eventType: 'user.registered',
      actorUserId: id,
      requestId: req.requestId,
      message: `User registered: ${email}`,
      metadata: { role },
    });

    return res.status(201).json(authResponseForUser(user, settings));
  });

  app.post('/api/auth/login', (req, res) => {
    assertPasswordAuthEnabled();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password ?? '');

    const user = db
      .prepare(
        `SELECT id, email, display_name, role, password_hash, auth_provider, auth_subject, account_status,
                failed_login_attempts, last_failed_login_at, locked_until, settings_json
         FROM users
         WHERE email = ?`
      )
      .get(email);

    const lockState = getLoginLockState(user);
    if (lockState.locked) {
      writeAuditEvent({
        eventType: 'auth.login_blocked',
        level: 'warn',
        actorUserId: user.id,
        requestId: req.requestId,
        message: `Blocked login for locked account: ${email || 'unknown email'}`,
        metadata: { lockedUntil: lockState.lockedUntil, retryAfterSeconds: lockState.retryAfterSeconds },
      });
      res.setHeader('Retry-After', String(lockState.retryAfterSeconds));
      return res.status(429).json({ error: 'Too many login attempts. Try again shortly.' });
    }

    const passwordValid = user && user.account_status === 'active' && canUsePasswordAuth(user) && verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      let lockApplied = false;
      if (user && user.account_status === 'active' && canUsePasswordAuth(user)) {
        const failureState = recordLoginFailure(user.id);
        lockApplied = failureState.lockApplied;
      }
      writeAuditEvent({
        eventType: lockApplied ? 'auth.login_locked' : 'auth.login_failed',
        level: 'warn',
        actorUserId: user?.id ?? null,
        requestId: req.requestId,
        message: `Failed login attempt for ${email || 'unknown email'}`,
      });
      if (lockApplied) {
        res.setHeader('Retry-After', String(Math.ceil(LOGIN_LOCK_MS / 1000)));
        return res.status(429).json({ error: 'Too many login attempts. Try again shortly.' });
      }
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const resolvedRole = getUserRole(user.email, user.role);
    if (resolvedRole !== user.role) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(resolvedRole, user.id);
      user.role = resolvedRole;
    }
    clearLoginFailures(user.id);
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), user.id);
    const token = createSession(user.id);
    setSessionCookie(res, token);

    writeAuditEvent({
      eventType: 'auth.login_succeeded',
      actorUserId: user.id,
      requestId: req.requestId,
      message: `User logged in: ${user.email}`,
    });

    return res.json(authResponseForUser(user));
  });

  app.post('/api/auth/logout', requireAuth, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
    clearSessionCookie(res);
    writeAuditEvent({
      eventType: 'auth.logout',
      actorUserId: req.user.id,
      requestId: req.requestId,
      message: `User logged out: ${req.user.email}`,
    });
    res.status(204).end();
  });

  app.get('/api/auth/session', requireAuth, (req, res) => {
    const resolvedRole = getUserRole(req.user.email, req.user.role);
    if (resolvedRole !== req.user.role) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(resolvedRole, req.user.id);
      req.user.role = resolvedRole;
    }
    res.json(authResponseForUser(req.user));
  });

  app.put('/api/settings', requireAuth, (req, res) => {
    const nextState = normalizeState(req.body);
    db.prepare('UPDATE users SET settings_json = ? WHERE id = ?')
      .run(JSON.stringify(nextState), req.user.id);

    writeAuditEvent({
      eventType: 'settings.updated',
      actorUserId: req.user.id,
      requestId: req.requestId,
      message: 'User settings updated.',
    });

    res.json({ settings: nextState });
  });

  app.post('/api/logs/client-error', requireAuth, (req, res) => {
    const message = String(req.body?.message ?? '').trim();
    const source = String(req.body?.source ?? 'client');
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    writeAuditEvent({
      eventType: 'client.error',
      level: 'error',
      actorUserId: req.user.id,
      requestId: req.requestId,
      message,
      metadata: {
        source,
        stack: typeof req.body?.stack === 'string' ? req.body.stack : null,
        userAgent: req.get('user-agent') ?? null,
      },
    });

    res.status(204).end();
  });

  app.get('/api/admin/summary', requireAuth, requireAdmin, (_req, res) => {
    const flags = getFeatureFlags();
    const counts = db.prepare(`
      SELECT
        COUNT(*) AS totalUsers,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS adminUsers,
        SUM(CASE WHEN auth_provider = 'local' THEN 1 ELSE 0 END) AS localUsers,
        SUM(CASE WHEN account_status = 'active' THEN 1 ELSE 0 END) AS activeUsers,
        SUM(CASE WHEN account_status = 'suspended' THEN 1 ELSE 0 END) AS suspendedUsers,
        SUM(CASE WHEN locked_until IS NOT NULL AND locked_until > ? THEN 1 ELSE 0 END) AS lockedUsers
      FROM users
    `).get(new Date().toISOString());
    const recentEvents = db.prepare(`
      SELECT id, event_type, level, actor_user_id, target_user_id, request_id, message, metadata_json, created_at
      FROM audit_events
      ORDER BY created_at DESC
      LIMIT 50
    `).all().map((row) => ({
      id: row.id,
      eventType: row.event_type,
      level: row.level,
      actorUserId: row.actor_user_id,
      targetUserId: row.target_user_id,
      requestId: row.request_id,
      message: row.message,
      metadata: parseJsonSafely(row.metadata_json),
      createdAt: row.created_at,
    }));

    res.json({
      flags,
      metrics: {
        totalUsers: Number(counts.totalUsers ?? 0),
        adminUsers: Number(counts.adminUsers ?? 0),
        localUsers: Number(counts.localUsers ?? 0),
        activeUsers: Number(counts.activeUsers ?? 0),
        suspendedUsers: Number(counts.suspendedUsers ?? 0),
        lockedUsers: Number(counts.lockedUsers ?? 0),
      },
      recentEvents,
      auth: getAuthConfig(),
    });
  });

  app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
    const query = String(req.query.query ?? '').trim().toLowerCase();
    const nowIso = new Date().toISOString();
    const sql = `
      SELECT id, email, display_name, role, auth_provider, account_status, created_at, last_login_at,
             failed_login_attempts, last_failed_login_at, locked_until,
             (
               SELECT COUNT(*)
               FROM sessions
               WHERE sessions.user_id = users.id
                 AND (sessions.expires_at IS NULL OR sessions.expires_at > ?)
             ) AS active_session_count
      FROM users
      WHERE (? = '' OR lower(email) LIKE ? OR lower(display_name) LIKE ?)
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const likeQuery = `%${query}%`;
    const users = db.prepare(sql).all(nowIso, query, likeQuery, likeQuery).map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      authProvider: row.auth_provider,
      accountStatus: row.account_status,
      activeSessionCount: Number(row.active_session_count ?? 0),
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      failedLoginAttempts: Number(row.failed_login_attempts ?? 0),
      lastFailedLoginAt: row.last_failed_login_at,
      loginLockedUntil: getLoginLockState(row).locked ? row.locked_until : null,
    }));

    res.json({ users });
  });

  app.get('/api/admin/users/:userId', requireAuth, requireAdmin, (req, res) => {
    const targetUserId = String(req.params.userId ?? '').trim();
    const nowIso = new Date().toISOString();
    const target = db
      .prepare(
        `SELECT id, email, display_name, role, auth_provider, account_status, created_at, last_login_at,
                failed_login_attempts, last_failed_login_at, locked_until, settings_json
         FROM users
         WHERE id = ?`
      )
      .get(targetUserId);
    if (!target) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const sessions = db
      .prepare(
        `SELECT token, created_at, expires_at
         FROM sessions
         WHERE user_id = ?
           AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY created_at DESC
         LIMIT 25`
      )
      .all(targetUserId, nowIso)
      .map((row) => ({
        tokenSuffix: String(row.token).slice(-8),
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      }));

    return res.json({
      user: {
        ...publicUser(target),
        createdAt: target.created_at,
        lastLoginAt: target.last_login_at,
      },
      activeSessionCount: activeSessionCountForUser(targetUserId, nowIso),
      sessions,
      plannerStateSummary: plannerStateSummaryForSettings(target.settings_json),
    });
  });

  app.put('/api/admin/flags/:key', requireAuth, requireAdmin, (req, res) => {
    const key = String(req.params.key ?? '').trim();
    const enabled = Boolean(req.body?.enabled);
    const existing = db.prepare('SELECT key, description FROM feature_flags WHERE key = ?').get(key);
    if (!existing) {
      return res.status(404).json({ error: 'Feature flag not found.' });
    }

    db.prepare(`
      UPDATE feature_flags
      SET enabled = ?, updated_at = ?, updated_by_user_id = ?
      WHERE key = ?
    `).run(enabled ? 1 : 0, new Date().toISOString(), req.user.id, key);

    writeAuditEvent({
      eventType: 'admin.feature_flag_updated',
      actorUserId: req.user.id,
      requestId: req.requestId,
      message: `Feature flag ${key} set to ${enabled ? 'enabled' : 'disabled'}.`,
      metadata: { key, enabled },
    });

    res.json({ flags: getFeatureFlags() });
  });

  app.post('/api/admin/users/:userId/reset', requireAuth, requireAdmin, (req, res) => {
    const targetUserId = String(req.params.userId ?? '').trim();
    const preserveCurrentSession = Boolean(req.body?.preserveCurrentSession);
    if (targetUserId === req.user.id && !preserveCurrentSession) {
      return res.status(400).json({ error: 'Use preserveCurrentSession to reset your own account without ending your session.' });
    }
    const target = db
      .prepare(
        'SELECT id, email, display_name, role, auth_provider, account_status, failed_login_attempts, last_failed_login_at, locked_until FROM users WHERE id = ?'
      )
      .get(targetUserId);
    if (!target) {
      return res.status(404).json({ error: 'User not found.' });
    }

    db.prepare('UPDATE users SET settings_json = ? WHERE id = ?')
      .run(JSON.stringify(buildDefaultState()), targetUserId);
    let preservedCurrentSession = false;
    if (targetUserId === req.user.id && preserveCurrentSession) {
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?').run(targetUserId, req.sessionToken);
      preservedCurrentSession = true;
    } else {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetUserId);
    }

    writeAuditEvent({
      eventType: 'admin.user_reset',
      level: 'warn',
      actorUserId: req.user.id,
      targetUserId,
      requestId: req.requestId,
      message: `User reset by admin: ${target.email}`,
      metadata: { preservedCurrentSession },
    });

    res.json({
      ok: true,
      preservedCurrentSession,
      user: publicUser(target),
    });
  });

  app.post('/api/admin/users/:userId/seed-demo', requireAuth, requireAdmin, (req, res) => {
    const targetUserId = String(req.params.userId ?? '').trim();
    const target = db
      .prepare('SELECT id, email, display_name, role, auth_provider, account_status, settings_json FROM users WHERE id = ?')
      .get(targetUserId);
    if (!target) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const seededState = seedDemoPlannerState(target.settings_json);
    db.prepare('UPDATE users SET settings_json = ? WHERE id = ?')
      .run(JSON.stringify(seededState), targetUserId);

    writeAuditEvent({
      eventType: 'admin.user_seeded_demo',
      level: 'warn',
      actorUserId: req.user.id,
      targetUserId,
      requestId: req.requestId,
      message: `Demo planner state seeded by admin: ${target.email}`,
    });

    return res.json({
      ok: true,
      user: publicUser(target),
      plannerStateSummary: plannerStateSummaryForSettings(JSON.stringify(seededState)),
    });
  });

  app.post('/api/admin/users/:userId/clear-activity', requireAuth, requireAdmin, (req, res) => {
    const targetUserId = String(req.params.userId ?? '').trim();
    const target = db
      .prepare('SELECT id, email, display_name, role, auth_provider, account_status, settings_json FROM users WHERE id = ?')
      .get(targetUserId);
    if (!target) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const clearedState = clearPlannerActivity(target.settings_json);
    db.prepare('UPDATE users SET settings_json = ? WHERE id = ?')
      .run(JSON.stringify(clearedState), targetUserId);

    writeAuditEvent({
      eventType: 'admin.user_activity_cleared',
      level: 'warn',
      actorUserId: req.user.id,
      targetUserId,
      requestId: req.requestId,
      message: `Planner activity cleared by admin: ${target.email}`,
    });

    return res.json({
      ok: true,
      user: publicUser(target),
      plannerStateSummary: plannerStateSummaryForSettings(JSON.stringify(clearedState)),
    });
  });

  app.put('/api/admin/users/:userId/status', requireAuth, requireAdmin, (req, res) => {
    const targetUserId = String(req.params.userId ?? '').trim();
    const nextStatus = String(req.body?.accountStatus ?? '').trim().toLowerCase();
    if (!['active', 'suspended'].includes(nextStatus)) {
      return res.status(400).json({ error: 'accountStatus must be "active" or "suspended".' });
    }
    if (targetUserId === req.user.id && nextStatus !== 'active') {
      return res.status(400).json({ error: 'Admin users cannot suspend their own account.' });
    }

    const target = db
      .prepare(
        'SELECT id, email, display_name, role, auth_provider, account_status, failed_login_attempts, last_failed_login_at, locked_until FROM users WHERE id = ?'
      )
      .get(targetUserId);
    if (!target) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (target.account_status === nextStatus) {
      return res.json({
        ok: true,
        changed: false,
        revokedSessions: 0,
        user: publicUser({ ...target, account_status: nextStatus }),
      });
    }

    const updatedAt = new Date().toISOString();
    db.prepare('UPDATE users SET account_status = ? WHERE id = ?').run(nextStatus, targetUserId);
    if (nextStatus === 'active') {
      clearLoginFailures(targetUserId);
    }
    let revokedSessions = 0;
    if (nextStatus === 'suspended') {
      const result = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetUserId);
      revokedSessions = Number(result.changes ?? 0);
    }

    writeAuditEvent({
      eventType: 'admin.user_status_updated',
      level: 'warn',
      actorUserId: req.user.id,
      targetUserId,
      requestId: req.requestId,
      message: `User account ${nextStatus}: ${target.email}`,
      metadata: { nextStatus, revokedSessions, updatedAt },
    });

    return res.json({
      ok: true,
      changed: true,
      revokedSessions,
      user: publicUser({ ...target, account_status: nextStatus }),
    });
  });

  app.post('/api/admin/users/:userId/revoke-sessions', requireAuth, requireAdmin, (req, res) => {
    const targetUserId = String(req.params.userId ?? '').trim();
    const target = db.prepare('SELECT id, email, display_name, role, auth_provider, account_status FROM users WHERE id = ?').get(targetUserId);
    if (!target) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let revokedSessions = 0;
    let preservedCurrentSession = false;
    if (targetUserId === req.user.id) {
      const result = db.prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?').run(targetUserId, req.sessionToken);
      revokedSessions = Number(result.changes ?? 0);
      preservedCurrentSession = true;
    } else {
      const result = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetUserId);
      revokedSessions = Number(result.changes ?? 0);
    }

    writeAuditEvent({
      eventType: 'admin.user_sessions_revoked',
      level: 'warn',
      actorUserId: req.user.id,
      targetUserId,
      requestId: req.requestId,
      message: `User sessions revoked by admin: ${target.email}`,
      metadata: { revokedSessions, preservedCurrentSession },
    });

    return res.json({
      ok: true,
      revokedSessions,
      preservedCurrentSession,
      user: publicUser(target),
    });
  });

  app.post('/api/admin/users/:userId/unlock', requireAuth, requireAdmin, (req, res) => {
    const targetUserId = String(req.params.userId ?? '').trim();
    const target = db
      .prepare(
        'SELECT id, email, display_name, role, auth_provider, account_status, failed_login_attempts, last_failed_login_at, locked_until FROM users WHERE id = ?'
      )
      .get(targetUserId);
    if (!target) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const lockState = getLoginLockState(target);
    const hadFailureState = lockState.locked || Number(target.failed_login_attempts ?? 0) > 0 || Boolean(target.last_failed_login_at);
    clearLoginFailures(targetUserId);

    writeAuditEvent({
      eventType: 'admin.user_unlock',
      level: 'warn',
      actorUserId: req.user.id,
      targetUserId,
      requestId: req.requestId,
      message: `User auth lock reset by admin: ${target.email}`,
      metadata: { hadFailureState },
    });

    return res.json({
      ok: true,
      changed: hadFailureState,
    });
  });

  app.get('/api/context/brief', requireAuth, async (req, res) => {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lon);
    const persisted = parseStoredSettings(req.user.settings_json);
    const timeZone = String(req.query.timeZone ?? req.query.tz ?? persisted.preferences?.timeZone ?? 'UTC');
    const timeDetails = getTimeDetails(timeZone);

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
      const response = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${query.toString()}`);
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

  app.use((error, req, res, _next) => {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    writeAuditEvent({
      eventType: statusCode >= 500 ? 'server.error' : 'server.warning',
      level: statusCode >= 500 ? 'error' : 'warn',
      actorUserId: req.user?.id ?? null,
      requestId: req.requestId ?? null,
      message: String(error?.message ?? error ?? 'Unhandled server error'),
      metadata: { stack: error?.stack ?? null, path: req.originalUrl ?? null },
    });
    if (res.headersSent) {
      return;
    }
    res.status(statusCode).json({ error: statusCode >= 500 ? 'Internal server error.' : String(error?.message ?? 'Request failed.') });
  });

  return app;
}
