export function ProfileView({
  user,
  settings,
  goals,
  cycleInfo,
  locationStatus,
  syncLocationNow,
  setSiteView,
  setSettings,
  isCycleTrackingEnabled,
  authConfig,
  adminBootstrapEligible,
  adminClaimPending,
  adminClaimStatus,
  claimAdminAccess,
}) {
  return (
    <section className="card">
      <p className="card-label">Profile</p>
      <h3>{user.displayName}</h3>
      <p className="muted-copy">{user.email}</p>
      <p className="muted-copy">Timezone: {settings.preferences?.timeZone || 'UTC'}</p>

      <div style={{ marginTop: '1rem' }}>
        <p className="card-label">Goals</p>
        <div className="goal-grid">
          {goals.map((goal) => (
            <button
              key={goal.key}
              className={`goal-chip ${(settings.preferences?.goals ?? []).includes(goal.key) ? 'active' : 'ghost'}`}
              onClick={() => {
                setSettings((state) => {
                  const current = state.preferences?.goals ?? [];
                  const next = current.includes(goal.key)
                    ? current.filter((item) => item !== goal.key)
                    : [...current, goal.key];
                  return { ...state, preferences: { ...(state.preferences ?? {}), goals: next } };
                });
              }}
            >
              {goal.label}
            </button>
          ))}
        </div>
      </div>

      {isCycleTrackingEnabled && (
        <div style={{ marginTop: '1rem' }}>
          <p className="card-label">Cycle tracking</p>
          <div className="button-row" style={{ marginBottom: '0.5rem' }}>
            <button
              className={settings.preferences?.trackCycle ? 'secondary small' : 'ghost small'}
              onClick={() => setSettings((state) => ({
                ...state,
                preferences: { ...(state.preferences ?? {}), trackCycle: !state.preferences?.trackCycle },
              }))}
            >
              {settings.preferences?.trackCycle ? 'Tracking enabled' : 'Enable cycle tracking'}
            </button>
          </div>
          {settings.preferences?.trackCycle && (
            <div className="setup-grid">
              <label>
                Last period start date
                <input
                  type="date"
                  value={settings.preferences?.cycleStartDate ?? ''}
                  onChange={(event) => setSettings((state) => ({
                    ...state,
                    preferences: { ...(state.preferences ?? {}), cycleStartDate: event.target.value },
                  }))}
                />
              </label>
              <label>
                Average cycle length (days)
                <input
                  type="number"
                  min="20"
                  max="45"
                  value={settings.preferences?.cycleLength ?? 28}
                  onChange={(event) => setSettings((state) => ({
                    ...state,
                    preferences: { ...(state.preferences ?? {}), cycleLength: Number(event.target.value) },
                  }))}
                />
              </label>
              {cycleInfo && (
                <p className="muted-copy">Current phase: {cycleInfo.label} (day {cycleInfo.day})</p>
              )}
            </div>
          )}
        </div>
      )}

      {user.role !== 'admin' && authConfig?.mode === 'local' && (
        <div style={{ marginTop: '1rem' }}>
          <p className="card-label">Admin access</p>
          <p className="muted-copy">
            {adminBootstrapEligible
              ? 'No admin account exists yet. You can claim admin access for local testing.'
              : 'An admin account already exists for this environment.'}
          </p>
          <div className="button-row" style={{ marginTop: '0.45rem' }}>
            <button
              className="ghost"
              disabled={!adminBootstrapEligible || adminClaimPending}
              onClick={claimAdminAccess}
            >
              {adminClaimPending ? 'Claiming admin access...' : 'Claim admin access'}
            </button>
          </div>
          {adminClaimStatus && <p className="status-message">{adminClaimStatus}</p>}
        </div>
      )}

      <div className="button-row" style={{ marginTop: '1rem' }}>
        <button className="ghost" onClick={() => setSiteView('planner')}>Back to dashboard</button>
        <button className="secondary" onClick={syncLocationNow}>Update location</button>
      </div>
      {locationStatus && <p className="status-message">{locationStatus}</p>}
    </section>
  );
}
