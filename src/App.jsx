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

const STORAGE_KEY = 'focus-flow-state-v1';

const defaultPhases = [
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
];

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

export default function App() {
  const [phases, setPhases] = useState(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return defaultPhases;
    }

    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed.phases) && parsed.phases.length > 0 ? parsed.phases : defaultPhases;
    } catch {
      return defaultPhases;
    }
  });
  const [activePhaseId, setActivePhaseId] = useState(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return defaultPhases[0].id;
    }

    try {
      return JSON.parse(saved).activePhaseId ?? defaultPhases[0].id;
    } catch {
      return defaultPhases[0].id;
    }
  });
  const [phaseRemaining, setPhaseRemaining] = useState(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return defaultPhases[0].defaultMinutes * 60;
    }

    try {
      return JSON.parse(saved).phaseRemaining ?? defaultPhases[0].defaultMinutes * 60;
    } catch {
      return defaultPhases[0].defaultMinutes * 60;
    }
  });
  const [phaseDurationInput, setPhaseDurationInput] = useState(defaultPhases[0].defaultMinutes);
  const [phaseRunning, setPhaseRunning] = useState(false);
  const [healthState, setHealthState] = useState(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return 'steady';
    }

    try {
      return JSON.parse(saved).healthState ?? 'steady';
    } catch {
      return 'steady';
    }
  });
  const [taskTitleInput, setTaskTitleInput] = useState('');
  const [taskMinutesInput, setTaskMinutesInput] = useState('');
  const [phaseNameInput, setPhaseNameInput] = useState('');
  const [phaseDefaultMinutesInput, setPhaseDefaultMinutesInput] = useState('90');
  const [activeTaskTimerId, setActiveTaskTimerId] = useState(null);
  const [taskTimerRemaining, setTaskTimerRemaining] = useState(0);
  const phaseIntervalRef = useRef(null);
  const taskIntervalRef = useRef(null);

  const activePhase = useMemo(
    () => phases.find((phase) => phase.id === activePhaseId) ?? phases[0],
    [activePhaseId, phases]
  );

  useEffect(() => {
    setPhaseDurationInput(activePhase.defaultMinutes);
    setPhaseRemaining(activePhase.defaultMinutes * 60);
    setPhaseRunning(false);
    setActiveTaskTimerId(null);
    setTaskTimerRemaining(0);
  }, [activePhaseId, activePhase.defaultMinutes]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        phases,
        activePhaseId,
        phaseRemaining,
        healthState,
      })
    );
  }, [activePhaseId, healthState, phaseRemaining, phases]);

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

  const completionRatio = useMemo(() => {
    const total = activePhase.tasks.length;
    if (total === 0) {
      return 0;
    }
    const completed = activePhase.tasks.filter((task) => task.done).length;
    return completed / total;
  }, [activePhase.tasks]);

  const recommendation = HEALTH_OPTIONS.find((option) => option.key === healthState)?.guidance;

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

  function updateActivePhase(patch) {
    setPhases((currentPhases) =>
      currentPhases.map((phase) => (phase.id === activePhase.id ? { ...phase, ...patch } : phase))
    );
  }

  function updateTasks(updater) {
    setPhases((currentPhases) =>
      currentPhases.map((phase) =>
        phase.id === activePhase.id ? { ...phase, tasks: updater(phase.tasks) } : phase
      )
    );
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

    setPhases((currentPhases) => [...currentPhases, nextPhase]);
    setActivePhaseId(nextPhase.id);
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Focus Flow</p>
          <h1>ADHD-friendly day planning</h1>
          <p className="lede">
            Break the day into flexible phases, start with a quick mind check, and use nested timers when a task needs tighter structure.
          </p>
        </div>

          <div className="phase-list">
            {phases.map((phase) => (
              <button
              key={phase.id}
              className={`phase-chip ${phase.id === activePhaseId ? 'active' : ''}`}
                onClick={() => setActivePhaseId(phase.id)}
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
            <div className="button-row">
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
                className={`health-option ${healthState === option.key ? 'selected' : ''}`}
                onClick={() => setHealthState(option.key)}
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
