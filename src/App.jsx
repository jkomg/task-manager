import { useEffect, useMemo, useRef, useState } from 'react';

const HEALTH_OPTIONS = [
  {
    key: 'steady',
    label: 'Steady',
    guidance: 'Keep the planned sequence. Start with one short win to build momentum.',
  },
  {
    key: 'scattered',
    label: 'Scattered',
    guidance: 'Reduce the phase to the three most important tasks and prefer timed work blocks.',
  },
  {
    key: 'drained',
    label: 'Drained',
    guidance: 'Shift toward low-friction tasks, add hydration, and shorten timers by 5 minutes.',
  },
];

const DEFAULT_SETTINGS = {
  phases: [
    {
      id: 'phase-1',
      name: 'Morning',
      defaultMinutes: 180,
      tasks: [
        { id: 'task-1', title: 'Wake-up routine', done: false, minutes: 15 },
        { id: 'task-2', title: 'Review top 3 priorities', done: false, minutes: 10 },
        { id: 'task-3', title: 'Deep work block', done: false, minutes: 45 },
      ],
    },
    {
      id: 'phase-2',
      name: 'Afternoon',
      defaultMinutes: 240,
      tasks: [
        { id: 'task-4', title: 'Admin cleanup', done: false, minutes: 20 },
        { id: 'task-5', title: 'Errands or outreach', done: false, minutes: null },
      ],
    },
    {
      id: 'phase-3',
      name: 'Evening',
      defaultMinutes: 180,
      tasks: [
        { id: 'task-6', title: 'Reset space', done: false, minutes: 15 },
        { id: 'task-7', title: 'Wind-down routine', done: false, minutes: 30 },
      ],
    },
  ],
  activePhaseId: 'phase-1',
  healthState: 'steady',
};

function formatSeconds(totalSeconds) {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function createTask(title, minutes = null) {
  return {
    id: `task-${crypto.randomUUID()}`,
    title,
    done: false,
    minutes,
  };
}

function moveItem(items, fromIndex, toIndex) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? 'Request failed.');
  }

  return data;
}

function AuthScreen({ mode, form, onModeChange, onChange, onSubmit, authPending, authError }) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div>
          <p className="eyebrow">Focus Flow</p>
          <h1>Account-based local testing</h1>
          <p className="lede">
            Create an account so your phases, routines, and ADHD-friendly setup are saved in the local app database.
          </p>
        </div>

        <div className="auth-toggle">
          <button
            className={mode === 'login' ? 'active-tab' : 'ghost'}
            onClick={() => onModeChange('login')}
            type="button"
          >
            Sign in
          </button>
          <button
            className={mode === 'register' ? 'active-tab' : 'ghost'}
            onClick={() => onModeChange('register')}
            type="button"
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {mode === 'register' && (
            <label>
              Name
              <input
                name="displayName"
                value={form.displayName}
                onChange={onChange}
                placeholder="Alex"
                autoComplete="name"
              />
            </label>
          )}

          <label>
            Email
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="alex@example.com"
              autoComplete="email"
            />
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

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState('');
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState('Not saved yet');
  const [taskTitleInput, setTaskTitleInput] = useState('');
  const [taskMinutesInput, setTaskMinutesInput] = useState('');
  const [phaseNameInput, setPhaseNameInput] = useState('');
  const [phaseDefaultMinutesInput, setPhaseDefaultMinutesInput] = useState('90');
  const [phaseDurationInput, setPhaseDurationInput] = useState(DEFAULT_SETTINGS.phases[0].defaultMinutes);
  const [phaseRemaining, setPhaseRemaining] = useState(DEFAULT_SETTINGS.phases[0].defaultMinutes * 60);
  const [phaseRunning, setPhaseRunning] = useState(false);
  const [activeTaskTimerId, setActiveTaskTimerId] = useState(null);
  const [taskTimerRemaining, setTaskTimerRemaining] = useState(0);
  const [authForm, setAuthForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });
  const phaseIntervalRef = useRef(null);
  const taskIntervalRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const loadedSettingsRef = useRef(false);

  const activePhase = useMemo(
    () => settings.phases.find((phase) => phase.id === settings.activePhaseId) ?? settings.phases[0],
    [settings]
  );

  const completionRatio = useMemo(() => {
    const total = activePhase?.tasks.length ?? 0;
    if (total === 0) {
      return 0;
    }

    return activePhase.tasks.filter((task) => task.done).length / total;
  }, [activePhase]);

  const recommendation = HEALTH_OPTIONS.find((option) => option.key === settings.healthState)?.guidance;

  useEffect(() => {
    let cancelled = false;

    api('/api/auth/session')
      .then((data) => {
        if (cancelled) {
          return;
        }
        setUser(data.user);
        setSettings(data.settings);
        setSaveStatus('All changes saved');
        loadedSettingsRef.current = true;
      })
      .catch(() => {
        if (!cancelled) {
          loadedSettingsRef.current = false;
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthChecked(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activePhase) {
      return;
    }

    setPhaseDurationInput(activePhase.defaultMinutes);
    setPhaseRemaining(activePhase.defaultMinutes * 60);
    setPhaseRunning(false);
    setActiveTaskTimerId(null);
    setTaskTimerRemaining(0);
  }, [activePhase?.id, activePhase?.defaultMinutes]);

  useEffect(() => {
    if (!phaseRunning) {
      window.clearInterval(phaseIntervalRef.current);
      return undefined;
    }

    phaseIntervalRef.current = window.setInterval(() => {
      setPhaseRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(phaseIntervalRef.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(phaseIntervalRef.current);
  }, [phaseRunning]);

  useEffect(() => {
    if (!activeTaskTimerId) {
      window.clearInterval(taskIntervalRef.current);
      return undefined;
    }

    taskIntervalRef.current = window.setInterval(() => {
      setTaskTimerRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(taskIntervalRef.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(taskIntervalRef.current);
  }, [activeTaskTimerId]);

  useEffect(() => {
    if (!user || !loadedSettingsRef.current) {
      return undefined;
    }

    window.clearTimeout(saveTimeoutRef.current);
    setSaveStatus('Saving...');
    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        await api('/api/settings', {
          method: 'PUT',
          body: JSON.stringify(settings),
        });
        setSaveStatus('All changes saved');
      } catch (error) {
        setSaveStatus(error.message);
      }
    }, 500);

    return () => window.clearTimeout(saveTimeoutRef.current);
  }, [settings, user]);

  function setSettingsPatch(patch) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function updateActivePhase(patch) {
    setSettings((current) => ({
      ...current,
      phases: current.phases.map((phase) =>
        phase.id === current.activePhaseId ? { ...phase, ...patch } : phase
      ),
    }));
  }

  function updateTasks(updater) {
    setSettings((current) => ({
      ...current,
      phases: current.phases.map((phase) =>
        phase.id === current.activePhaseId ? { ...phase, tasks: updater(phase.tasks) } : phase
      ),
    }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthPending(true);
    setAuthError('');

    try {
      const path = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const data = await api(path, {
        method: 'POST',
        body: JSON.stringify(authForm),
      });

      setUser(data.user);
      setSettings(data.settings);
      loadedSettingsRef.current = true;
      setAuthChecked(true);
      setAuthForm({ displayName: '', email: '', password: '' });
      setSaveStatus('All changes saved');
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthPending(false);
    }
  }

  async function handleLogout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout cleanup failures and reset UI locally.
    }

    loadedSettingsRef.current = false;
    setUser(null);
    setSettings(DEFAULT_SETTINGS);
    setAuthMode('login');
    setAuthError('');
    setSaveStatus('Signed out');
  }

  function handleStartPhase() {
    const nextMinutes = Number(phaseDurationInput);
    if (!Number.isFinite(nextMinutes) || nextMinutes <= 0) {
      return;
    }

    setPhaseRemaining(nextMinutes * 60);
    setPhaseRunning(true);
  }

  function handlePausePhase() {
    setPhaseRunning(false);
  }

  function handleResetPhase() {
    setPhaseRunning(false);
    setPhaseRemaining(activePhase.defaultMinutes * 60);
    setPhaseDurationInput(activePhase.defaultMinutes);
  }

  function toggleTask(taskId) {
    updateTasks((tasks) =>
      tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task))
    );
  }

  function addTask(event) {
    event.preventDefault();
    const title = taskTitleInput.trim();
    if (!title) {
      return;
    }

    const parsedMinutes = Number(taskMinutesInput);
    updateTasks((tasks) => [
      ...tasks,
      createTask(title, Number.isFinite(parsedMinutes) && parsedMinutes > 0 ? parsedMinutes : null),
    ]);
    setTaskTitleInput('');
    setTaskMinutesInput('');
  }

  function addPhase(event) {
    event.preventDefault();
    const name = phaseNameInput.trim();
    const minutes = Number(phaseDefaultMinutesInput);
    if (!name || !Number.isFinite(minutes) || minutes <= 0) {
      return;
    }

    const nextPhase = {
      id: `phase-${crypto.randomUUID()}`,
      name,
      defaultMinutes: minutes,
      tasks: [createTask('First step', 10)],
    };

    setSettings((current) => ({
      ...current,
      phases: [...current.phases, nextPhase],
      activePhaseId: nextPhase.id,
    }));
    setPhaseRemaining(minutes * 60);
    setPhaseNameInput('');
    setPhaseDefaultMinutesInput('90');
  }

  function moveTask(taskId, direction) {
    const index = activePhase.tasks.findIndex((task) => task.id === taskId);
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= activePhase.tasks.length) {
      return;
    }

    updateTasks((tasks) => moveItem(tasks, index, nextIndex));
  }

  function startTaskTimer(task) {
    if (!task.minutes) {
      return;
    }

    setActiveTaskTimerId(task.id);
    setTaskTimerRemaining(task.minutes * 60);
  }

  function stopTaskTimer() {
    setActiveTaskTimerId(null);
    setTaskTimerRemaining(0);
  }

  if (!authChecked) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Focus Flow</p>
          <h1>Loading your workspace</h1>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        mode={authMode}
        form={authForm}
        onModeChange={setAuthMode}
        onChange={(event) =>
          setAuthForm((current) => ({
            ...current,
            [event.target.name]: event.target.value,
          }))
        }
        onSubmit={handleAuthSubmit}
        authPending={authPending}
        authError={authError}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Focus Flow</p>
          <h1>ADHD-friendly day planning</h1>
          <p className="lede">
            Signed in as {user.displayName}. Your phase setup is stored in the local app account and restored on refresh.
          </p>
        </div>

        <div className="card account-card">
          <p className="card-label">Account</p>
          <strong>{user.email}</strong>
          <span className="muted-copy">{saveStatus}</span>
          <button className="ghost" onClick={handleLogout}>Sign out</button>
        </div>

        <div className="phase-list">
          {settings.phases.map((phase) => (
            <button
              key={phase.id}
              className={`phase-chip ${phase.id === settings.activePhaseId ? 'active' : ''}`}
              onClick={() => setSettingsPatch({ activePhaseId: phase.id })}
            >
              <span>{phase.name}</span>
              <small>{phase.defaultMinutes} min default</small>
            </button>
          ))}
        </div>

        <form className="phase-form" onSubmit={addPhase}>
          <input
            type="text"
            placeholder="New phase name"
            value={phaseNameInput}
            onChange={(event) => setPhaseNameInput(event.target.value)}
          />
          <input
            type="number"
            min="1"
            placeholder="Default min"
            value={phaseDefaultMinutesInput}
            onChange={(event) => setPhaseDefaultMinutesInput(event.target.value)}
          />
          <button type="submit">Add phase</button>
        </form>

        <div className="card accent-card">
          <p className="card-label">Phase progress</p>
          <strong>{Math.round(completionRatio * 100)}% complete</strong>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${completionRatio * 100}%` }} />
          </div>
        </div>
      </aside>

      <main className="main-grid">
        <section className="card hero-card">
          <div className="hero-topline">
            <div>
              <p className="card-label">Current phase</p>
              <h2>{activePhase.name}</h2>
            </div>
            <div className={`timer-pill ${phaseRunning ? 'running' : ''}`}>{formatSeconds(phaseRemaining)}</div>
          </div>

          <div className="phase-controls">
            <label>
              Phase duration (minutes)
              <input
                type="number"
                min="1"
                value={phaseDurationInput}
                onChange={(event) => setPhaseDurationInput(event.target.value)}
              />
            </label>

            <label>
              Phase name
              <input
                type="text"
                value={activePhase.name}
                onChange={(event) => updateActivePhase({ name: event.target.value })}
              />
            </label>

            <label>
              Default length for this phase
              <input
                type="number"
                min="1"
                value={activePhase.defaultMinutes}
                onChange={(event) => {
                  const minutes = Number(event.target.value);
                  if (Number.isFinite(minutes) && minutes > 0) {
                    updateActivePhase({ defaultMinutes: minutes });
                  }
                }}
              />
            </label>

            <div className="button-row phase-action-row">
              <button onClick={handleStartPhase}>Start phase</button>
              <button className="secondary" onClick={handlePausePhase}>Pause</button>
              <button className="ghost" onClick={handleResetPhase}>Reset</button>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <p className="card-label">Mind check</p>
              <h3>How are you starting this phase?</h3>
            </div>
          </div>

          <div className="health-grid">
            {HEALTH_OPTIONS.map((option) => (
              <button
                key={option.key}
                className={`health-option ${settings.healthState === option.key ? 'selected' : ''}`}
                onClick={() => setSettingsPatch({ healthState: option.key })}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="recommendation">{recommendation}</p>
        </section>

        <section className="card flow-card">
          <div className="section-header">
            <div>
              <p className="card-label">Routine flow</p>
              <h3>Ordered checklist for this phase</h3>
            </div>
          </div>

          <div className="task-list">
            {activePhase.tasks.map((task, index) => {
              const taskTimerActive = activeTaskTimerId === task.id;
              return (
                <article key={task.id} className={`task-row ${task.done ? 'done' : ''}`}>
                  <button
                    className={`task-check ${task.done ? 'checked' : ''}`}
                    onClick={() => toggleTask(task.id)}
                    aria-label={task.done ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}
                  />

                  <div className="task-copy">
                    <strong>{task.title}</strong>
                    <span>
                      Step {index + 1}
                      {task.minutes ? ` • ${task.minutes} min timer available` : ' • Flexible timing'}
                    </span>
                    {taskTimerActive && (
                      <div className="nested-timer">
                        <span>Task timer: {formatSeconds(taskTimerRemaining)}</span>
                        <button className="ghost small" onClick={stopTaskTimer}>Stop task timer</button>
                      </div>
                    )}
                  </div>

                  <div className="task-actions">
                    <button className="ghost small" onClick={() => moveTask(task.id, 'up')}>Up</button>
                    <button className="ghost small" onClick={() => moveTask(task.id, 'down')}>Down</button>
                    {task.minutes && !taskTimerActive && (
                      <button className="secondary small" onClick={() => startTaskTimer(task)}>Start timer</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <form className="add-task-form" onSubmit={addTask}>
            <input
              type="text"
              placeholder="Add a task for this phase"
              value={taskTitleInput}
              onChange={(event) => setTaskTitleInput(event.target.value)}
            />
            <input
              type="number"
              min="1"
              placeholder="Timer min"
              value={taskMinutesInput}
              onChange={(event) => setTaskMinutesInput(event.target.value)}
            />
            <button type="submit">Add task</button>
          </form>
        </section>
      </main>
    </div>
  );
}
