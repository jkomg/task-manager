import bcrypt from 'bcryptjs';

const AUTH_MODE = process.env.AUTH_MODE === 'managed' ? 'managed' : 'local';
const MANAGED_AUTH_PROVIDER = String(process.env.MANAGED_AUTH_PROVIDER ?? '').trim() || null;

export function getAuthConfig() {
  return {
    mode: AUTH_MODE,
    passwordSignInEnabled: AUTH_MODE === 'local',
    registrationEnabled: AUTH_MODE === 'local',
    managedProvider: AUTH_MODE === 'managed' ? MANAGED_AUTH_PROVIDER ?? 'external' : null,
  };
}

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function assertPasswordAuthEnabled() {
  if (AUTH_MODE === 'local') {
    return;
  }
  const error = new Error('Password sign-in is disabled for this deployment.');
  error.statusCode = 503;
  throw error;
}

export function buildLocalIdentity(email) {
  const normalizedEmail = normalizeEmail(email);
  return {
    authProvider: 'local',
    authSubject: normalizedEmail,
  };
}

export function hashPassword(password) {
  return bcrypt.hashSync(String(password ?? ''), 10);
}

export function verifyPassword(password, passwordHash) {
  if (!passwordHash) {
    return false;
  }
  return bcrypt.compareSync(String(password ?? ''), passwordHash);
}

export function canUsePasswordAuth(user) {
  return user?.auth_provider === 'local' && typeof user?.password_hash === 'string' && user.password_hash.length > 0;
}
