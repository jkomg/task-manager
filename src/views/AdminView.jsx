import { useState } from 'react';

export function AdminView({
  user,
  adminSummary,
  adminUsers,
  adminQuery,
  adminLoading,
  adminStatus,
  selectedAdminUser,
  featureFlags,
  setAdminQuery,
  refreshAdminSummary,
  searchAdminUsers,
  toggleFeatureFlag,
  resetUserState,
  inspectUser,
  setUserAccountStatus,
  revokeUserSessions,
  seedDemoState,
  clearUserActivity,
  unlockUserAuth,
  createAdminUser,
  resetUserPassword,
  deleteUserAccount,
}) {
  const [createUserDraft, setCreateUserDraft] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'user',
  });
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const isLocalAuth = (adminSummary.auth?.mode ?? 'local') === 'local';

  function confirmAndRun(message, action) {
    if (!window.confirm(message)) {
      return;
    }
    void action();
  }

  async function onCreateUserSubmit(event) {
    event.preventDefault();
    const payload = {
      displayName: createUserDraft.displayName.trim(),
      email: createUserDraft.email.trim(),
      password: createUserDraft.password,
      role: createUserDraft.role,
    };
    const created = await createAdminUser(payload);
    if (!created) {
      return;
    }
    setCreateUserDraft({
      displayName: '',
      email: '',
      password: '',
      role: 'user',
    });
  }

  async function onResetPassword(adminUser) {
    const password = String(passwordDrafts[adminUser.id] ?? '');
    if (password.length < 8) {
      window.alert('Password must be at least 8 characters.');
      return;
    }

    confirmAndRun(`Reset password for ${adminUser.email}?`, async () => {
      const changed = await resetUserPassword(adminUser.id, password);
      if (changed) {
        setPasswordDrafts((current) => ({ ...current, [adminUser.id]: '' }));
      }
    });
  }

  return (
    <section className="card admin-grid">
      <div className="admin-section">
        <div className="section-header">
          <div>
            <p className="card-label">Admin controls</p>
            <h3>Feature flags</h3>
          </div>
          <button className="ghost small" onClick={refreshAdminSummary}>Refresh</button>
        </div>
        <p className="muted-copy">Use these to stage or hide product features during testing.</p>
        <div className="admin-flag-list">
          {(adminSummary.flags ?? featureFlags).map((flag) => (
            <div key={flag.key} className="admin-flag-row">
              <div>
                <strong>{flag.key}</strong>
                <p className="muted-copy">{flag.description}</p>
              </div>
              <button
                className={flag.enabled ? 'secondary small' : 'ghost small'}
                onClick={() => toggleFeatureFlag(flag.key, !flag.enabled)}
              >
                {flag.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-section">
        <p className="card-label">Snapshot</p>
        <h3>Environment</h3>
        <div className="admin-metrics">
          <div className="admin-metric">
            <span>Total users</span>
            <strong>{adminSummary.metrics?.totalUsers ?? 0}</strong>
          </div>
          <div className="admin-metric">
            <span>Admins</span>
            <strong>{adminSummary.metrics?.adminUsers ?? 0}</strong>
          </div>
          <div className="admin-metric">
            <span>Local auth users</span>
            <strong>{adminSummary.metrics?.localUsers ?? 0}</strong>
          </div>
          <div className="admin-metric">
            <span>Active accounts</span>
            <strong>{adminSummary.metrics?.activeUsers ?? 0}</strong>
          </div>
          <div className="admin-metric">
            <span>Suspended accounts</span>
            <strong>{adminSummary.metrics?.suspendedUsers ?? 0}</strong>
          </div>
          <div className="admin-metric">
            <span>Locked logins</span>
            <strong>{adminSummary.metrics?.lockedUsers ?? 0}</strong>
          </div>
          <div className="admin-metric">
            <span>Flags</span>
            <strong>{(adminSummary.flags ?? featureFlags).length}</strong>
          </div>
        </div>
        <p className="muted-copy" style={{ marginTop: '0.75rem' }}>
          Auth mode: {adminSummary.auth?.mode ?? 'local'}
          {adminSummary.auth?.managedProvider ? ` · ${adminSummary.auth.managedProvider}` : ''}
        </p>
      </div>

      <div className="admin-section">
        <div className="section-header">
          <div>
            <p className="card-label">Testing tools</p>
            <h3>Users</h3>
          </div>
        </div>
        <form
          className="admin-user-search"
          onSubmit={(event) => {
            event.preventDefault();
            searchAdminUsers(adminQuery);
          }}
        >
          <input
            type="text"
            placeholder="Search by email or name"
            value={adminQuery}
            onChange={(event) => setAdminQuery(event.target.value)}
          />
          <button type="submit" className="secondary">Search</button>
        </form>
        {isLocalAuth && (
          <form className="admin-user-create-form" onSubmit={onCreateUserSubmit}>
            <input
              type="text"
              placeholder="Display name"
              value={createUserDraft.displayName}
              onChange={(event) => setCreateUserDraft((current) => ({ ...current, displayName: event.target.value }))}
              autoComplete="name"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={createUserDraft.email}
              onChange={(event) => setCreateUserDraft((current) => ({ ...current, email: event.target.value }))}
              autoComplete="email"
              required
            />
            <input
              type="password"
              placeholder="Temporary password"
              value={createUserDraft.password}
              onChange={(event) => setCreateUserDraft((current) => ({ ...current, password: event.target.value }))}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <select
              value={createUserDraft.role}
              onChange={(event) => setCreateUserDraft((current) => ({ ...current, role: event.target.value }))}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="secondary">Create user</button>
          </form>
        )}
        {!isLocalAuth && (
          <p className="muted-copy">Managed auth mode is enabled. User creation and password reset are unavailable here.</p>
        )}
        <div className="admin-user-list">
          {adminUsers.map((adminUser) => (
            <div key={adminUser.id} className="admin-user-row">
              <div>
                <strong>{adminUser.displayName}</strong>
                <p className="muted-copy">
                  {adminUser.email} · {adminUser.role} · {adminUser.authProvider} · {adminUser.accountStatus}
                </p>
                <p className="muted-copy">
                  Active sessions {adminUser.activeSessionCount ?? 0}
                </p>
                {adminUser.loginLockedUntil && (
                  <p className="muted-copy">Login locked until {new Date(adminUser.loginLockedUntil).toLocaleString()}</p>
                )}
                {!adminUser.loginLockedUntil && (adminUser.failedLoginAttempts ?? 0) > 0 && (
                  <p className="muted-copy">
                    Failed login attempts {adminUser.failedLoginAttempts}
                    {adminUser.lastFailedLoginAt ? ` · last ${new Date(adminUser.lastFailedLoginAt).toLocaleString()}` : ''}
                  </p>
                )}
                {adminUser.lastLoginAt && (
                  <p className="muted-copy">Last login {new Date(adminUser.lastLoginAt).toLocaleString()}</p>
                )}
              </div>
              <div className="admin-action-row">
                <button className="ghost small" onClick={() => inspectUser(adminUser.id)}>
                  Inspect
                </button>
                <button
                  className="ghost small"
                  onClick={() =>
                    confirmAndRun(
                      `Revoke active sessions for ${adminUser.email}?`,
                      () => revokeUserSessions(adminUser.id)
                    )
                  }
                >
                  Revoke sessions
                </button>
                <button
                  className="ghost small"
                  disabled={adminUser.id === user.id && adminUser.accountStatus === 'active'}
                  onClick={() =>
                    confirmAndRun(
                      adminUser.accountStatus === 'active'
                        ? `Suspend ${adminUser.email}? This also revokes current sessions.`
                        : `Reactivate ${adminUser.email}?`,
                      () => setUserAccountStatus(adminUser.id, adminUser.accountStatus === 'active' ? 'suspended' : 'active')
                    )
                  }
                >
                  {adminUser.accountStatus === 'active' ? 'Suspend' : 'Reactivate'}
                </button>
                <button
                  className="ghost small"
                  onClick={() =>
                    confirmAndRun(
                      adminUser.id === user.id
                        ? 'Reset your own planner state and keep this current session?'
                        : `Reset all planner state for ${adminUser.email}?`,
                      () => resetUserState(adminUser.id, adminUser.id === user.id ? { preserveCurrentSession: true } : undefined)
                    )
                  }
                >
                  {adminUser.id === user.id ? 'Reset my state' : 'Reset state'}
                </button>
                <button
                  className="ghost small"
                  onClick={() =>
                    confirmAndRun(
                      `Clear login lock state for ${adminUser.email}?`,
                      () => unlockUserAuth(adminUser.id)
                    )
                  }
                >
                  Unlock login
                </button>
                <button
                  className="ghost small"
                  onClick={() =>
                    confirmAndRun(
                      `Seed demo planner data for ${adminUser.email}?`,
                      () => seedDemoState(adminUser.id)
                    )
                  }
                >
                  Seed demo
                </button>
                <button
                  className="ghost small"
                  onClick={() =>
                    confirmAndRun(
                      `Clear planner activity for ${adminUser.email}? One-off tasks and completion state will be removed.`,
                      () => clearUserActivity(adminUser.id)
                    )
                  }
                >
                  Clear activity
                </button>
                {isLocalAuth && (
                  <>
                    <input
                      type="password"
                      placeholder="New password"
                      value={passwordDrafts[adminUser.id] ?? ''}
                      onChange={(event) => setPasswordDrafts((current) => ({ ...current, [adminUser.id]: event.target.value }))}
                      autoComplete="new-password"
                      minLength={8}
                      className="admin-password-input"
                    />
                    <button
                      className="ghost small"
                      onClick={() => onResetPassword(adminUser)}
                    >
                      Set password
                    </button>
                  </>
                )}
                <button
                  className="ghost small"
                  disabled={adminUser.id === user.id}
                  onClick={() =>
                    confirmAndRun(
                      `Delete account ${adminUser.email}? This cannot be undone.`,
                      () => deleteUserAccount(adminUser.id)
                    )
                  }
                >
                  Delete user
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedAdminUser?.user && (
        <div className="admin-section">
          <div className="section-header">
            <div>
              <p className="card-label">Selected user</p>
              <h3>{selectedAdminUser.user.displayName}</h3>
            </div>
          </div>
          <p className="muted-copy">
            {selectedAdminUser.user.email} · {selectedAdminUser.user.role} · {selectedAdminUser.user.authProvider} · {selectedAdminUser.user.accountStatus}
          </p>
          <div className="admin-metrics">
            <div className="admin-metric">
              <span>Active sessions</span>
              <strong>{selectedAdminUser.activeSessionCount ?? 0}</strong>
            </div>
            <div className="admin-metric">
              <span>Phases</span>
              <strong>{selectedAdminUser.plannerStateSummary?.phaseCount ?? 0}</strong>
            </div>
            <div className="admin-metric">
              <span>Tasks</span>
              <strong>{selectedAdminUser.plannerStateSummary?.totalTasks ?? 0}</strong>
            </div>
            <div className="admin-metric">
              <span>Completed tasks</span>
              <strong>{selectedAdminUser.plannerStateSummary?.completedTasks ?? 0}</strong>
            </div>
            <div className="admin-metric">
              <span>Failed logins</span>
              <strong>{selectedAdminUser.user.failedLoginAttempts ?? 0}</strong>
            </div>
          </div>
          {selectedAdminUser.user.loginLockedUntil && (
            <p className="muted-copy">Login locked until {new Date(selectedAdminUser.user.loginLockedUntil).toLocaleString()}</p>
          )}
          <p className="muted-copy">
            Routine {selectedAdminUser.plannerStateSummary?.routineType ?? 'session'} · Health {selectedAdminUser.plannerStateSummary?.healthState ?? 'steady'} · Setup {selectedAdminUser.plannerStateSummary?.setupComplete ? 'complete' : 'pending'} · Onboarding {selectedAdminUser.plannerStateSummary?.onboardingComplete ? 'complete' : 'pending'}
          </p>
          <div className="admin-event-list">
            {(selectedAdminUser.sessions ?? []).map((session) => (
              <div key={`${session.tokenSuffix}-${session.createdAt}`} className="admin-event-row">
                <div className="admin-event-topline">
                  <strong>Session ...{session.tokenSuffix}</strong>
                  <span>{new Date(session.createdAt).toLocaleString()}</span>
                </div>
                <p className="muted-copy">
                  Expires {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : 'Never'}
                </p>
              </div>
            ))}
            {(selectedAdminUser.sessions ?? []).length === 0 && (
              <p className="muted-copy">No active sessions.</p>
            )}
          </div>
        </div>
      )}

      <div className="admin-section">
        <div className="section-header">
          <div>
            <p className="card-label">Observability</p>
            <h3>Recent events</h3>
          </div>
        </div>
        <div className="admin-event-list">
          {(adminSummary.recentEvents ?? []).map((event) => (
            <div key={event.id} className={`admin-event-row ${event.level}`}>
              <div className="admin-event-topline">
                <strong>{event.eventType}</strong>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
              </div>
              <p>{event.message}</p>
              {event.requestId && <span className="muted-copy">Request {event.requestId}</span>}
            </div>
          ))}
        </div>
      </div>

      {adminLoading && <p className="status-message">Loading admin data...</p>}
      {adminStatus && <p className="status-message">{adminStatus}</p>}
    </section>
  );
}
