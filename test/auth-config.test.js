import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const authModuleUrl = pathToFileURL(path.join(repoRoot, 'server', 'auth.js')).href;

test('managed auth mode disables password auth helpers', () => {
  const script = `
    import { assertPasswordAuthEnabled, getAuthConfig } from ${JSON.stringify(authModuleUrl)};
    let blocked = null;
    try {
      assertPasswordAuthEnabled();
    } catch (error) {
      blocked = { message: error.message, statusCode: error.statusCode };
    }
    console.log(JSON.stringify({ config: getAuthConfig(), blocked }));
  `;

  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AUTH_MODE: 'managed',
      MANAGED_AUTH_PROVIDER: 'firebase-auth',
    },
    encoding: 'utf8',
  });

  const payload = JSON.parse(output.trim());
  assert.equal(payload.config.mode, 'managed');
  assert.equal(payload.config.passwordSignInEnabled, false);
  assert.equal(payload.config.registrationEnabled, false);
  assert.equal(payload.config.managedProvider, 'firebase-auth');
  assert.deepEqual(payload.blocked, {
    message: 'Password sign-in is disabled for this deployment.',
    statusCode: 503,
  });
});
