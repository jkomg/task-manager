export function OnboardingFlow({
  onboardingStep,
  settings,
  goals,
  setupDraft,
  setOnboardingStep,
  setSettings,
  setSetupDraft,
  completeFirstSetup,
  isCycleTrackingEnabled,
}) {
  return (
    <section className="card onboarding-card">
      {onboardingStep === 0 && (
        <>
          <p className="card-label">Welcome to Focus Flow</p>
          <h2>What are you working toward?</h2>
          <p className="lede">Select everything that applies — this helps the app surface the right tasks and timing for you.</p>
          <div className="goal-grid">
            {goals.map((goal) => (
              <button
                key={goal.key}
                className={`goal-chip ${(settings.preferences?.goals ?? []).includes(goal.key) ? 'active' : 'ghost'}`}
                onClick={() => {
                  setSettings((current) => {
                    const selected = current.preferences?.goals ?? [];
                    const nextGoals = selected.includes(goal.key)
                      ? selected.filter((item) => item !== goal.key)
                      : [...selected, goal.key];
                    return {
                      ...current,
                      preferences: {
                        ...(current.preferences ?? {}),
                        goals: nextGoals,
                      },
                    };
                  });
                }}
              >
                {goal.label}
              </button>
            ))}
          </div>
          <button
            className="secondary"
            style={{ marginTop: '1rem' }}
            onClick={() => setOnboardingStep(isCycleTrackingEnabled ? 1 : 2)}
          >
            Continue
          </button>
        </>
      )}

      {onboardingStep === 1 && isCycleTrackingEnabled && (
        <>
          <p className="card-label">Optional: hormonal context</p>
          <h2>Do you want to track your cycle?</h2>
          <p className="lede">
            If you track a menstrual cycle, Focus Flow can offer gentle nudges based on your current phase — no pressure, always optional, and easy to update anytime.
          </p>
          <div className="button-row" style={{ marginTop: '0.5rem' }}>
            <button
              className={settings.preferences?.trackCycle ? 'secondary' : 'ghost'}
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  preferences: {
                    ...(current.preferences ?? {}),
                    trackCycle: true,
                  },
                }))
              }
            >
              Yes, track my cycle
            </button>
            <button
              className="ghost"
              onClick={() => {
                setSettings((current) => ({
                  ...current,
                  preferences: {
                    ...(current.preferences ?? {}),
                    trackCycle: false,
                  },
                }));
                setOnboardingStep(2);
              }}
            >
              Skip for now
            </button>
          </div>
          {settings.preferences?.trackCycle && (
            <div className="setup-grid" style={{ marginTop: '1rem' }}>
              <label>
                When did your last period start?
                <input
                  type="date"
                  value={settings.preferences?.cycleStartDate ?? ''}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      preferences: {
                        ...(current.preferences ?? {}),
                        cycleStartDate: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label>
                Average cycle length (days)
                <input
                  type="number"
                  min="20"
                  max="45"
                  value={settings.preferences?.cycleLength ?? 28}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      preferences: {
                        ...(current.preferences ?? {}),
                        cycleLength: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
              <button className="secondary" onClick={() => setOnboardingStep(2)}>
                Continue
              </button>
            </div>
          )}
          <button className="ghost small" style={{ marginTop: '0.5rem' }} onClick={() => setOnboardingStep(0)}>
            Back
          </button>
        </>
      )}

      {onboardingStep === 2 && (
        <>
          <p className="card-label">Almost there</p>
          <h2>Set your phase durations</h2>
          <p className="lede">How long do you want each phase to run by default? You can adjust these anytime in Settings.</p>
          <div className="setup-grid">
            {settings.phases.map((phase) => (
              <label key={phase.id}>
                {phase.name}
                <input
                  type="number"
                  min="1"
                  value={setupDraft[phase.id] ?? phase.defaultMinutes}
                  onChange={(event) =>
                    setSetupDraft((current) => ({
                      ...current,
                      [phase.id]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="button-row" style={{ marginTop: '1rem' }}>
            <button className="secondary" onClick={completeFirstSetup}>
              Start your day
            </button>
            <button className="ghost small" onClick={() => setOnboardingStep(1)}>
              Back
            </button>
          </div>
        </>
      )}
    </section>
  );
}
