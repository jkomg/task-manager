export function AdminView({
  user,
  adminSummary,
  adminUsers,
  adminQuery,
  adminLoading,
  adminStatus,
  featureFlags,
  setAdminQuery,
  refreshAdminSummary,
  searchAdminUsers,
  toggleFeatureFlag,
  resetUserState,
}) {
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
                {adminUser.lastLoginAt && (
                  <p className="muted-copy">Last login {new Date(adminUser.lastLoginAt).toLocaleString()}</p>
                )}
              </div>
              <button
                className="ghost small"
                disabled={adminUser.id === user.id}
                onClick={() => resetUserState(adminUser.id)}
              >
                {adminUser.id === user.id ? 'Current user' : 'Reset user'}
              </button>
            </div>
          ))}
        </div>
      </div>

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
