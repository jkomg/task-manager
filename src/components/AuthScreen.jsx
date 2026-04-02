export function AuthScreen({ mode, form, onModeChange, onChange, onSubmit, authPending, authError }) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div>
          <p className="eyebrow">Focus Flow</p>
          <h1>Sign in to your rhythm</h1>
          <p className="lede">
            Your phase setup, routines, and mind-check context are saved to your local account.
          </p>
        </div>

        <div className="auth-toggle">
          <button className={mode === 'login' ? 'active-tab' : 'ghost'} onClick={() => onModeChange('login')} type="button">
            Sign in
          </button>
          <button className={mode === 'register' ? 'active-tab' : 'ghost'} onClick={() => onModeChange('register')} type="button">
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {mode === 'register' && (
            <label>
              Name
              <input name="displayName" value={form.displayName} onChange={onChange} placeholder="Alex" autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" value={form.email} onChange={onChange} placeholder="alex@example.com" autoComplete="email" />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              placeholder="At least 8 characters"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          {authError && <p className="status-message error">{authError}</p>}
          <button type="submit" disabled={authPending}>
            {authPending ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>
    </main>
  );
}
