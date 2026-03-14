import { useEffect, useMemo, useRef, useState } from 'react';
import calmBanner from './assets/calm-banner.svg';

const HEALTH_OPTIONS = [
  { key: 'steady', label: 'Steady', guidance: 'Keep momentum with one clear next step and low friction.' },
  { key: 'scattered', label: 'Scattered', guidance: 'Shrink scope and use shorter timed blocks with visible boundaries.' },
  { key: 'drained', label: 'Drained', guidance: 'Choose lighter tasks, reduce transitions, and protect recovery.' },
];

const ROUTINE_OPTIONS = [
  { key: 'session', label: 'Session Day', note: 'Full rhythm with generative work and structured recovery blocks.' },
  { key: 'integration', label: 'Integration Day', note: 'Lighter rhythm for regulation, review, and maintenance.' },
];

const TASK_LIBRARY = {
  session: {
    morning: [
      { title: 'Body scan + jaw check', minutes: 3 },
      { title: 'Input reading', minutes: 25 },
      { title: 'Capture ideas in notebook', minutes: 10 },
      { title: 'Spanish primer', minutes: 20 },
    ],
    activation: [
      { title: 'Compost existing captures', minutes: 20 },
      { title: 'Light writing touch', minutes: 25 },
      { title: 'Spanish mid-touch', minutes: 15 },
      { title: 'Define one outcome for Deep Window', minutes: 5 },
    ],
    deep: [
      { title: 'Deep writing block (Draft or Revise)', minutes: 50 },
      { title: 'Reading as writer (craft study)', minutes: 25 },
      { title: 'Admin sweep', minutes: 20 },
      { title: 'Spanish focused review', minutes: 20 },
    ],
    recovery: [
      { title: 'Rehab movement set', minutes: 30 },
      { title: 'Upright tolerance block', minutes: 15 },
      { title: 'Legs up / restorative break', minutes: 15 },
      { title: 'Capture one sentence', minutes: 5 },
    ],
    evening: [
      { title: 'System review + tomorrow setup', minutes: 15 },
      { title: 'Light Spanish', minutes: 20 },
      { title: 'Low-stakes reading or study', minutes: 25 },
      { title: 'Wind-down routine', minutes: 30 },
    ],
    custom: [
      { title: 'Define one clear outcome for this phase', minutes: 10 },
      { title: 'Focused block', minutes: 30 },
      { title: 'Reset and transition', minutes: 10 },
    ],
  },
  integration: {
    morning: [
      { title: 'Morning regulation block', minutes: 15 },
      { title: 'Gentle reading / input', minutes: 20 },
      { title: 'Capture one sentence', minutes: 5 },
      { title: 'Spanish light touch', minutes: 15 },
    ],
    activation: [
      { title: 'Compost existing notes (light)', minutes: 20 },
      { title: 'Lower-load writing touch', minutes: 25 },
      { title: 'Spanish easy review', minutes: 15 },
    ],
    deep: [
      { title: 'Lower-load writing or Study mode', minutes: 25 },
      { title: 'Gentle reading', minutes: 20 },
      { title: 'Easy maintenance task', minutes: 20 },
    ],
    recovery: [
      { title: 'Toe lifts + textured surface', minutes: 10 },
      { title: 'Restorative break / legs up', minutes: 20 },
      { title: '90/90 breathing if okay', minutes: 10 },
    ],
    evening: [
      { title: 'Flare protocol check-in', minutes: 10 },
      { title: 'Light planning for next day', minutes: 10 },
      { title: 'Wind-down and settle', minutes: 25 },
    ],
    custom: [
      { title: 'Reduce scope to one meaningful action', minutes: 10 },
      { title: 'Easy maintenance task', minutes: 20 },
      { title: 'Recovery break', minutes: 10 },
    ],
  },
};

// Energy modes from the PDF phase time map
const PHASE_ENERGY_MODES = {
  'quiet window':       { mode: 'Receptive + Absorptive',   hint: 'Input, gentle focus, capture' },
  'activation bridge':  { mode: 'Transitional',             hint: 'Compost, light writing, bridging to depth' },
  'deep window':        { mode: 'Generative + Executive',   hint: 'Draft, revise, deep cognitive work' },
  'body + recovery':    { mode: 'Physical + Lighter',       hint: 'Movement, rehab, restorative breaks' },
  'afternoon drift':    { mode: 'Flexible + Admin',         hint: 'Review, admin, light maintenance' },
  'evening wind-down':  { mode: 'Settling',                 hint: 'Wind-down, light reading, planning tomorrow' },
  morning:              { mode: 'Receptive + Absorptive',   hint: 'Input, gentle focus, capture' },
  afternoon:            { mode: 'Generative + Executive',   hint: 'Draft, revise, deep cognitive work' },
  evening:              { mode: 'Settling',                 hint: 'Wind-down, review, light tasks' },
};

function getEnergyMode(phaseName) {
  const key = String(phaseName ?? '').toLowerCase().trim();
  return (
    PHASE_ENERGY_MODES[key] ??
    PHASE_ENERGY_MODES[getPhaseKey(phaseName)] ??
    { mode: 'Focused', hint: 'Keep scope small and visible.' }
  );
}

// Writing modes from the PDF
const WRITING_MODES = {
  Capture: { energy: 'Almost none', bestWhen: 'Anytime', counts: 'A sentence, a phrase, a question' },
  Compost: { energy: 'Low–medium', bestWhen: 'Activation Bridge or low-energy Deep Window', counts: 'Connect captures, expand a fragment' },
  Draft:   { energy: 'High',       bestWhen: 'Deep Window with momentum',                   counts: '200–500 words of new material' },
  Revise:  { energy: 'Medium',     bestWhen: 'Deep Window or second-wind evenings',          counts: 'Make a draft 20% better' },
  Study:   { energy: 'Low–medium', bestWhen: 'Deep Window reading block or Quiet Window',    counts: 'Annotate, copy sentences, reverse-engineer' },
};

function getRecommendedWritingMode(phaseName, healthState) {
  const n = String(phaseName ?? '').toLowerCase();
  const isQuiet      = n.includes('quiet') || n.includes('morning');
  const isActivation = n.includes('activation') || n.includes('bridge');
  const isDeep       = n.includes('deep') || n.includes('window') || n.includes('afternoon') || n.includes('midday');
  const isBody       = n.includes('body') || n.includes('recovery');
  const isEvening    = n.includes('drift') || n.includes('wind') || n.includes('evening') || n.includes('night');

  if (isQuiet) return 'Study';
  if (isActivation) return healthState === 'drained' ? 'Capture' : 'Compost';
  if (isDeep) {
    if (healthState === 'drained') return 'Study';
    if (healthState === 'scattered') return 'Compost';
    return 'Draft';
  }
  if (isBody) return 'Capture';
  if (isEvening) return healthState === 'drained' ? 'Capture' : 'Revise';
  if (healthState === 'drained') return 'Capture';
  if (healthState === 'scattered') return 'Compost';
  return 'Draft';
}

const DEFAULT_SETTINGS = {
  phases: [
    {
      id: 'phase-1',
      name: 'Quiet Window',
      defaultMinutes: 90,
      tasks: [
        { id: 'task-1', title: 'Body scan + jaw check', done: false, minutes: 3 },
        { id: 'task-2', title: 'Input reading', done: false, minutes: 25 },
        { id: 'task-3', title: 'Capture ideas in notebook', done: false, minutes: 10 },
        { id: 'task-4', title: 'Spanish primer', done: false, minutes: 20 },
      ],
    },
    {
      id: 'phase-2',
      name: 'Activation Bridge',
      defaultMinutes: 60,
      tasks: [
        { id: 'task-5', title: 'Compost existing captures', done: false, minutes: 20 },
        { id: 'task-6', title: 'Light writing touch', done: false, minutes: 25 },
        { id: 'task-7', title: 'Spanish mid-touch', done: false, minutes: 15 },
      ],
    },
    {
      id: 'phase-3',
      name: 'Deep Window',
      defaultMinutes: 150,
      tasks: [
        { id: 'task-8', title: 'Deep writing block (Draft or Revise)', done: false, minutes: 50 },
        { id: 'task-9', title: 'Reading as writer (craft study)', done: false, minutes: 25 },
        { id: 'task-10', title: 'Admin sweep', done: false, minutes: 20 },
      ],
    },
    {
      id: 'phase-4',
      name: 'Body + Recovery',
      defaultMinutes: 120,
      tasks: [
        { id: 'task-11', title: 'Rehab movement set', done: false, minutes: 30 },
        { id: 'task-12', title: 'Legs up / restorative break', done: false, minutes: 15 },
        { id: 'task-13', title: 'Capture one sentence', done: false, minutes: 5 },
      ],
    },
    {
      id: 'phase-5',
      name: 'Afternoon Drift',
      defaultMinutes: 120,
      tasks: [
        { id: 'task-14', title: 'System review + tomorrow setup', done: false, minutes: 15 },
        { id: 'task-15', title: 'Light Spanish', done: false, minutes: 20 },
        { id: 'task-16', title: 'Wind-down routine', done: false, minutes: 30 },
      ],
    },
  ],
  activePhaseId: 'phase-1',
  healthState: 'steady',
  routineType: 'session',
  preferences: {
    setupComplete: false,
    timeZone: 'UTC',
    location: null,
  },
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

function firstName(displayName) {
  return String(displayName ?? '').trim().split(/\s+/)[0] || 'there';
}

function getPhaseKey(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('quiet') || n.includes('morning')) return 'morning';
  if (n.includes('activation') || n.includes('bridge')) return 'activation';
  if (n.includes('deep') || n.includes('window') || n.includes('afternoon') || n.includes('midday')) return 'deep';
  if (n.includes('body') || n.includes('recovery')) return 'recovery';
  if (n.includes('drift') || n.includes('wind') || n.includes('evening') || n.includes('night')) return 'evening';
  return 'custom';
}

function getSuggestions(routineType, phaseName) {
  const key = getPhaseKey(phaseName);
  const type = routineType === 'integration' ? 'integration' : 'session';
  return TASK_LIBRARY[type][key] ?? TASK_LIBRARY[type].custom;
}

function formatClockFromIso(iso, timeZone) {
  if (!iso) {
    return 'n/a';
  }
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone,
    }).format(new Date(iso));
  } catch {
    return 'n/a';
  }
}

function cognitionTip(period, healthState) {
  const base = {
    morning: 'Morning is best for planning and initiation. Keep early wins small and clear.',
    afternoon: 'Afternoon often benefits from structure. Use visible task boundaries and timed focus blocks.',
    evening: 'Evening works best for review, consolidation, and low-friction tasks.',
  }[period] ?? 'Use smaller steps and external cues to protect momentum.';

  if (healthState === 'scattered') {
    return `${base} For scattered attention, cap each step to 10 minutes.`;
  }
  if (healthState === 'drained') {
    return `${base} If energy is low, prioritize maintenance over expansion.`;
  }
  return base;
}

function greetingFor(period, phaseName, name) {
  if (String(phaseName).toLowerCase().includes('morning')) {
    return `Good morning, ${name}.`;
  }
  const byPeriod = {
    morning: `Good morning, ${name}.`,
    afternoon: `Good afternoon, ${name}.`,
    evening: `Good evening, ${name}.`,
  };
  return byPeriod[period] ?? `Hi ${name}.`;
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
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }
  return data;
}

function AuthScreen({ mode, form, onModeChange, onChange, onSubmit, authPending, authError }) {
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

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState('');
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState('Not saved yet');
  const [siteView, setSiteView] = useState('planner');
  const [menuOpen, setMenuOpen] = useState(false);
  const [taskTitleInput, setTaskTitleInput] = useState('');
  const [taskMinutesInput, setTaskMinutesInput] = useState('');
  const [phaseDurationInput, setPhaseDurationInput] = useState(DEFAULT_SETTINGS.phases[0].defaultMinutes);
  const [phaseRemaining, setPhaseRemaining] = useState(DEFAULT_SETTINGS.phases[0].defaultMinutes * 60);
  const [phaseRunning, setPhaseRunning] = useState(false);
  const [activeTaskTimerId, setActiveTaskTimerId] = useState(null);
  const [taskTimerRemaining, setTaskTimerRemaining] = useState(0);
  const [setupDraft, setSetupDraft] = useState({});
  const [locationStatus, setLocationStatus] = useState('');
  const [mindContext, setMindContext] = useState({ loading: false, data: null, error: '' });
  const [mindAction, setMindAction] = useState('');
  const [dayCheck, setDayCheck] = useState(null); // null | 'better' | 'mildly-worse' | 'clearly-worse'
  const [authForm, setAuthForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });
  const phaseIntervalRef = useRef(null);
  const taskIntervalRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const menuRef = useRef(null);
  const loadedSettingsRef = useRef(false);
  const locationTriedRef = useRef(false);

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
  const activeSuggestions = useMemo(
    () => getSuggestions(settings.routineType, activePhase?.name),
    [settings.routineType, activePhase?.name]
  );

  useEffect(() => {
    function onDocumentClick(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      window.addEventListener('mousedown', onDocumentClick);
    }
    return () => window.removeEventListener('mousedown', onDocumentClick);
  }, [menuOpen]);

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

  useEffect(() => {
    if (!user) {
      return;
    }
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    if (settings.preferences?.timeZone !== browserTimeZone) {
      setSettings((current) => ({
        ...current,
        preferences: {
          ...(current.preferences ?? {}),
          timeZone: browserTimeZone,
        },
      }));
    }
  }, [settings.preferences?.timeZone, user]);

  useEffect(() => {
    if (!settings.preferences?.setupComplete || settings.phases.length === 0) {
      return;
    }
    if (settings.preferences.location || locationTriedRef.current || !navigator.geolocation) {
      return;
    }

    locationTriedRef.current = true;
    setLocationStatus('Requesting location for weather-aware Mind Check...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        setSettings((current) => ({
          ...current,
          preferences: {
            ...(current.preferences ?? {}),
            timeZone,
            location: {
              latitude: Number(position.coords.latitude.toFixed(4)),
              longitude: Number(position.coords.longitude.toFixed(4)),
            },
          },
        }));
        setLocationStatus('Location linked.');
      },
      () => {
        setLocationStatus('Location unavailable. Mind Check will still use your timezone.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, [settings.preferences?.location, settings.preferences?.setupComplete, settings.phases.length]);

  useEffect(() => {
    if (!user || siteView !== 'planner') {
      return;
    }
    const timeZone = settings.preferences?.timeZone || 'UTC';
    const lat = settings.preferences?.location?.latitude;
    const lon = settings.preferences?.location?.longitude;
    const params = new URLSearchParams({ timeZone });
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      params.set('lat', String(lat));
      params.set('lon', String(lon));
    }

    let cancelled = false;
    setMindContext((current) => ({ ...current, loading: true, error: '' }));
    api(`/api/context/brief?${params.toString()}`)
      .then((data) => {
        if (!cancelled) {
          setMindContext({ loading: false, data, error: '' });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMindContext({ loading: false, data: null, error: error.message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [settings.preferences?.location, settings.preferences?.timeZone, siteView, user, settings.activePhaseId]);

  useEffect(() => {
    if (settings.preferences?.setupComplete) {
      return;
    }
    const nextDraft = {};
    settings.phases.forEach((phase) => {
      nextDraft[phase.id] = String(phase.defaultMinutes);
    });
    setSetupDraft(nextDraft);
  }, [settings.phases, settings.preferences?.setupComplete]);

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
      // ignore
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
    updateTasks((tasks) => [...tasks, createTask(title, Number.isFinite(parsedMinutes) && parsedMinutes > 0 ? parsedMinutes : null)]);
    setTaskTitleInput('');
    setTaskMinutesInput('');
  }

  function addSuggestionTask(suggestion) {
    updateTasks((tasks) => [...tasks, createTask(suggestion.title, suggestion.minutes ?? null)]);
  }

  function applyRoutineTemplate(nextType) {
    setSettings((current) => ({
      ...current,
      routineType: nextType,
      phases: current.phases.map((phase) => ({
        ...phase,
        tasks: getSuggestions(nextType, phase.name).slice(0, 4).map((task) => createTask(task.title, task.minutes)),
      })),
    }));
  }

  function insertPhaseAt(index) {
    setSettings((current) => {
      const safeIndex = Math.max(0, Math.min(index, current.phases.length));
      const nextNumber = current.phases.length + 1;
      const nextPhase = {
        id: `phase-${crypto.randomUUID()}`,
        name: `Phase ${nextNumber}`,
        defaultMinutes: 90,
        tasks: getSuggestions(current.routineType, 'custom').map((task) => createTask(task.title, task.minutes)),
      };
      const phases = [...current.phases];
      phases.splice(safeIndex, 0, nextPhase);
      return {
        ...current,
        phases,
        activePhaseId: nextPhase.id,
      };
    });
    setSiteView('settings');
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

  function completeFirstSetup() {
    const normalized = settings.phases.map((phase) => {
      const minutes = Number(setupDraft[phase.id]);
      return {
        ...phase,
        defaultMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : phase.defaultMinutes,
      };
    });
    setSettings((current) => ({
      ...current,
      phases: normalized,
      preferences: {
        ...(current.preferences ?? {}),
        setupComplete: true,
      },
    }));
    setSiteView('planner');
    setPhaseRunning(false);
  }

  function updatePhaseDefault(phaseId, nextValue) {
    const minutes = Number(nextValue);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return;
    }
    setSettings((current) => ({
      ...current,
      phases: current.phases.map((phase) => (phase.id === phaseId ? { ...phase, defaultMinutes: minutes } : phase)),
    }));
  }

  function updatePhaseName(phaseId, nextName) {
    setSettings((current) => ({
      ...current,
      phases: current.phases.map((phase) => (phase.id === phaseId ? { ...phase, name: nextName } : phase)),
    }));
  }

  function suggestNextAction() {
    const nextTask = activePhase.tasks.find((task) => !task.done);
    if (!nextTask) {
      setMindAction('This phase is complete. Take a short reset before switching context.');
      return;
    }
    const durationHint = nextTask.minutes ? `${nextTask.minutes} minutes` : settings.healthState === 'scattered' ? '10 minutes' : '20 minutes';
    setMindAction(`Start "${nextTask.title}" now for ${durationHint}. Keep distractions out until it is done.`);
  }

  function handleDayCheck(result) {
    setDayCheck(result);
    if (result === 'clearly-worse') {
      setSettingsPatch({ routineType: 'integration' });
    } else {
      setSettingsPatch({ routineType: 'session' });
    }
  }

  function refreshContext() {
    const lat = settings.preferences?.location?.latitude;
    const lon = settings.preferences?.location?.longitude;
    const timeZone = settings.preferences?.timeZone || 'UTC';
    const params = new URLSearchParams({ timeZone });
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      params.set('lat', String(lat));
      params.set('lon', String(lon));
    }

    setMindContext((current) => ({ ...current, loading: true, error: '' }));
    api(`/api/context/brief?${params.toString()}`)
      .then((data) => setMindContext({ loading: false, data, error: '' }))
      .catch((error) => setMindContext({ loading: false, data: null, error: error.message }));
  }

  function syncLocationNow() {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not available in this browser.');
      return;
    }
    setLocationStatus('Updating location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        setSettings((current) => ({
          ...current,
          preferences: {
            ...(current.preferences ?? {}),
            timeZone,
            location: {
              latitude: Number(position.coords.latitude.toFixed(4)),
              longitude: Number(position.coords.longitude.toFixed(4)),
            },
          },
        }));
        setLocationStatus('Location updated.');
      },
      () => setLocationStatus('Location permission denied or unavailable.'),
      { enableHighAccuracy: false, timeout: 8000 }
    );
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

  const contextPeriod = mindContext.data?.period ?? 'morning';
  const greeting = greetingFor(contextPeriod, activePhase.name, firstName(user.displayName));
  const weather = mindContext.data?.weather;
  const circadianText = cognitionTip(contextPeriod, settings.healthState);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <img src={calmBanner} alt="Calming landscape banner" className="calm-banner" />

        <div className="sidebar-identity">
          <span className="sidebar-app-name">Focus Flow</span>
          <div className="sidebar-user">
            <span>{firstName(user.displayName)}</span>
            <span
              className={`save-dot ${saveStatus === 'Saving...' ? 'saving' : saveStatus.startsWith('All') ? 'saved' : 'error'}`}
              title={saveStatus}
              aria-label={saveStatus}
            />
          </div>
        </div>

        {!settings.preferences?.setupComplete && (
          <section className="card setup-card">
            <p className="card-label">First login setup</p>
            <h3>Set initial phase durations</h3>
            <p className="lede">These are setup values only. Ongoing defaults live in Settings.</p>
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
            <button onClick={completeFirstSetup}>Save setup</button>
          </section>
        )}

        <div className="sidebar-footer">
          <div className="sidebar-progress">
            <div className="progress-track" aria-label={`${Math.round(completionRatio * 100)}% of phase tasks complete`}>
              <div className="progress-fill" style={{ width: `${completionRatio * 100}%` }} />
            </div>
            <span className="sidebar-progress-label">{Math.round(completionRatio * 100)}%</span>
          </div>
          <div className="sidebar-nav-links">
            <button className="ghost small" onClick={() => setSiteView('settings')}>Settings</button>
            <button className="ghost small" onClick={() => setSiteView('profile')}>Profile</button>
          </div>
        </div>
      </aside>

      <main className={siteView === 'planner' ? 'main-grid' : 'main-stack'}>
        <header className="card topbar-card">
          {siteView !== 'planner' ? (
            <div>
              <p className="card-label">Focus Flow</p>
              <h2>{siteView === 'settings' ? 'Settings' : 'Profile'}</h2>
            </div>
          ) : (
            <span className="topbar-app-name">Focus Flow</span>
          )}

          <div className="topbar-actions">
            {siteView !== 'planner' && (
              <button className="ghost small" onClick={() => setSiteView('planner')}>
                Back
              </button>
            )}
            <div className="profile-menu-wrap" ref={menuRef}>
              <button className="profile-trigger" onClick={() => setMenuOpen((current) => !current)}>
                {firstName(user.displayName).slice(0, 1).toUpperCase()}
              </button>
              {menuOpen && (
                <div className="profile-menu">
                  <button className="ghost menu-item" onClick={() => { setSiteView('profile'); setMenuOpen(false); }}>
                    Profile
                  </button>
                  <button className="ghost menu-item" onClick={() => { setSiteView('settings'); setMenuOpen(false); }}>
                    Settings
                  </button>
                  <button className="ghost menu-item" onClick={() => { setSiteView('planner'); setMenuOpen(false); }}>
                    Dashboard
                  </button>
                  <button className="ghost menu-item" onClick={handleLogout}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {siteView === 'profile' && (
          <section className="card">
            <p className="card-label">Profile</p>
            <h3>{user.displayName}</h3>
            <p className="muted-copy">{user.email}</p>
            <p className="muted-copy">Timezone: {settings.preferences?.timeZone || 'UTC'}</p>
            <p className="muted-copy">
              Location:{' '}
              {settings.preferences?.location
                ? `${settings.preferences.location.latitude}, ${settings.preferences.location.longitude}`
                : 'Not linked'}
            </p>
            <div className="button-row">
              <button className="ghost" onClick={() => setSiteView('planner')}>Back to dashboard</button>
              <button className="secondary" onClick={syncLocationNow}>Update location</button>
            </div>
            {locationStatus && <p className="status-message">{locationStatus}</p>}
          </section>
        )}

        {siteView === 'settings' && (
          <section className="card">
            <p className="card-label">Settings</p>
            <h3>Day template</h3>
            <p className="muted-copy">Choose how task suggestions populate your phases.</p>
            <div className="routine-grid">
              {ROUTINE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  className={`routine-chip ${settings.routineType === option.key ? 'active' : ''}`}
                  onClick={() => applyRoutineTemplate(option.key)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.note}</small>
                </button>
              ))}
            </div>
            <h3>Phase structure and defaults</h3>
            <div className="settings-phase-list">
              {settings.phases.map((phase, index) => (
                <div className="settings-phase-block" key={phase.id}>
                  <button className="ghost small insert-btn" onClick={() => insertPhaseAt(index)}>
                    + Insert phase above
                  </button>
                  <div className="settings-phase-row">
                    <label>
                      Phase name
                      <input type="text" value={phase.name} onChange={(event) => updatePhaseName(phase.id, event.target.value)} />
                    </label>
                    <label>
                      Default duration (min)
                      <input
                        type="number"
                        min="1"
                        value={phase.defaultMinutes}
                        onChange={(event) => updatePhaseDefault(phase.id, event.target.value)}
                      />
                    </label>
                    <button className="ghost small" onClick={() => setSettingsPatch({ activePhaseId: phase.id })}>Make active</button>
                  </div>
                </div>
              ))}
              <button className="secondary" onClick={() => insertPhaseAt(settings.phases.length)}>+ Add phase at end</button>
            </div>
          </section>
        )}

        {siteView === 'planner' && (
          <>
            {/* Phase time map */}
            <div className="card phase-map-card">
              {(() => {
                let cumulativeHours = 0;
                return settings.phases.map((phase) => {
                  const startH = cumulativeHours;
                  cumulativeHours += phase.defaultMinutes / 60;
                  const endH = cumulativeHours;
                  const isActive = phase.id === settings.activePhaseId;
                  const em = getEnergyMode(phase.name);
                  const openTasks = phase.tasks.filter((t) => !t.done).length;
                  const fmtH = (h) => Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
                  return (
                    <button
                      key={phase.id}
                      className={`phase-map-segment ${isActive ? 'active' : ''}`}
                      onClick={() => setSettingsPatch({ activePhaseId: phase.id })}
                      title={em.hint}
                    >
                      <span className="phase-map-hours">{fmtH(startH)}–{fmtH(endH)}</span>
                      <span className="phase-map-name">
                        {phase.name}
                        {openTasks > 0 && <span className="phase-map-badge">{openTasks}</span>}
                      </span>
                      <span className="phase-map-mode">{em.mode}</span>
                    </button>
                  );
                });
              })()}
            </div>

            {/* Hero / phase timer card */}
            <section className="card hero-card">
              <div className="hero-main">
                <div>
                  <p className="card-label">Current phase</p>
                  <h2>{activePhase.name}</h2>
                  <p className="phase-energy-label">{getEnergyMode(activePhase.name).mode}</p>
                </div>
                <div className="hero-timer-area">
                  <div className={`timer-pill ${phaseRunning ? 'running' : ''}`}>{formatSeconds(phaseRemaining)}</div>
                  <div className="timer-controls">
                    <input
                      type="number"
                      className="duration-input"
                      value={phaseDurationInput}
                      onChange={(event) => setPhaseDurationInput(event.target.value)}
                      title="Duration in minutes"
                    />
                    <button onClick={handleStartPhase}>Start</button>
                    <button className="secondary" onClick={handlePausePhase}>Pause</button>
                    <button className="ghost" onClick={handleResetPhase}>Reset</button>
                  </div>
                </div>
              </div>
            </section>

            {/* Mind Check card */}
            <section className="card">
              <div className="section-header">
                <div>
                  <p className="card-label">Mind Check</p>
                  <h3>{greeting}</h3>
                </div>
              </div>

              {/* Morning body scan / day type decision tree */}
              <div className="day-check-row">
                <span className="day-check-label">Body scan</span>
                <div className="day-check-options">
                  <button
                    className={`day-check-btn ${dayCheck === 'better' ? 'selected' : ''}`}
                    onClick={() => handleDayCheck('better')}
                    title="Better or Same → Session Day"
                  >
                    Better / Same
                  </button>
                  <button
                    className={`day-check-btn warn ${dayCheck === 'mildly-worse' ? 'selected' : ''}`}
                    onClick={() => handleDayCheck('mildly-worse')}
                    title="Mildly Worse → Session Day with adjustments"
                  >
                    Mildly Worse
                  </button>
                  <button
                    className={`day-check-btn danger ${dayCheck === 'clearly-worse' ? 'selected' : ''}`}
                    onClick={() => handleDayCheck('clearly-worse')}
                    title="Clearly Worse → Integration Day"
                  >
                    Clearly Worse
                  </button>
                </div>
              </div>

              {dayCheck === 'mildly-worse' && (
                <p className="decision-note warn">Session day — reduce upright block 2 min, skip side-lying work, extra legs up, consider cold face immersion.</p>
              )}
              {dayCheck === 'clearly-worse' && (
                <p className="decision-note danger">Integration day. Morning regulation only. Legs up liberally. Toe lifts + textured surface okay.</p>
              )}

              {/* Circadian guidance */}
              <p className="recommendation" style={{ marginTop: '0.75rem' }}>
                {getEnergyMode(activePhase.name).hint}
              </p>
              <p className="recommendation">{circadianText}</p>

              {/* Weather / location */}
              {mindContext.loading && <p className="status-message">Refreshing context...</p>}
              {mindContext.error && <p className="status-message error">{mindContext.error}</p>}
              {weather ? (
                <div className="context-box">
                  <p>
                    {weather.summary} · {Math.round(weather.temperatureC)}°C ·
                    Sunrise {formatClockFromIso(weather.sunrise, mindContext.data?.timeZone)} ·
                    Sunset {formatClockFromIso(weather.sunset, mindContext.data?.timeZone)}
                  </p>
                  <p>UV now {weather.uvNow ?? 'n/a'} · max {weather.uvMax ?? 'n/a'} · {weather.lightSuggestion}</p>
                </div>
              ) : (
                !mindContext.loading && (
                  <div className="location-prompt">
                    <p className="muted-copy">Link location for weather, UV index, and sunrise data.</p>
                    <button className="ghost small" onClick={syncLocationNow}>Link location</button>
                    {locationStatus && <p className="status-message">{locationStatus}</p>}
                  </div>
                )
              )}

              {/* Health state */}
              <div className="health-grid" style={{ marginTop: '0.75rem' }}>
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

              {/* Writing mode recommendation */}
              {(() => {
                const modeName = getRecommendedWritingMode(activePhase.name, settings.healthState);
                const mode = WRITING_MODES[modeName];
                return (
                  <div className="writing-mode-box">
                    <span className="writing-mode-label">Writing mode</span>
                    <div className="writing-mode-body">
                      <strong className="writing-mode-name">{modeName}</strong>
                      <span className="writing-mode-energy">{mode.energy} energy</span>
                      <span className="writing-mode-counts">{mode.counts}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="button-row" style={{ marginTop: '0.75rem' }}>
                <button className="secondary" onClick={suggestNextAction}>Suggest next action</button>
                <button className="ghost" onClick={refreshContext}>Refresh context</button>
              </div>
              {mindAction && <p className="status-message">{mindAction}</p>}
            </section>

            {/* Task flow card */}
            <section className="card flow-card">
              <div className="section-header">
                <div>
                  <p className="card-label">Task flow</p>
                  <h3>Action list for this phase</h3>
                </div>
              </div>

              <div className="suggestion-strip">
                {activeSuggestions.map((suggestion) => (
                  <button key={suggestion.title} className="ghost small" onClick={() => addSuggestionTask(suggestion)}>
                    + {suggestion.title}
                  </button>
                ))}
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
                          {task.minutes ? ` · ${task.minutes} min` : ' · Flexible timing'}
                        </span>
                        {taskTimerActive && (
                          <div className="nested-timer">
                            <span>Task timer: {formatSeconds(taskTimerRemaining)}</span>
                            <button className="ghost small" onClick={stopTaskTimer}>Stop timer</button>
                          </div>
                        )}
                      </div>
                      <div className="task-actions">
                        <button className="ghost small" onClick={() => moveTask(task.id, 'up')}>Up</button>
                        <button className="ghost small" onClick={() => moveTask(task.id, 'down')}>Down</button>
                        {task.minutes && !taskTimerActive && (
                          <button className="secondary small" onClick={() => startTaskTimer(task)}>Start</button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <form className="add-task-form" onSubmit={addTask}>
                <input type="text" placeholder="Add a task for this phase" value={taskTitleInput} onChange={(event) => setTaskTitleInput(event.target.value)} />
                <input type="number" placeholder="min (optional)" value={taskMinutesInput} onChange={(event) => setTaskMinutesInput(event.target.value)} />
                <button type="submit">Add task</button>
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
