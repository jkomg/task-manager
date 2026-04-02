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
}) {
  function confirmAndRun(message, action) {
    if (!window.confirm(message)) {
      return;
    }
    action();
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
                  disabled={adminUser.id === user.id}
                  onClick={() =>
                    confirmAndRun(
                      `Reset all planner state for ${adminUser.email}?`,
                      () => resetUserState(adminUser.id)
                    )
                  }
                >
                  {adminUser.id === user.id ? 'Current user' : 'Reset state'}
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
          </div>
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
