import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthScreen } from './components/AuthScreen.jsx';
import { OnboardingFlow } from './components/OnboardingFlow.jsx';
import { api, reportClientError } from './lib/api.js';
import {
  createTask,
  firstName,
  getActiveProfile,
  getBrowserTimeZone,
  getCyclePhase,
  getCycleTip,
  getDateKey,
  getProactiveTask,
  getSuggestions,
  greetingFor,
  storageKeyForUser,
  circadianWindow,
} from './lib/focusFlowCore.js';
import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_SETTINGS,
  GOAL_OPTIONS,
  ROUTINE_OPTIONS,
} from './lib/focusFlowData.js';
import { AdminView } from './views/AdminView.jsx';
import { PlannerView } from './views/PlannerView.jsx';
import { ProfileView } from './views/ProfileView.jsx';
import { SettingsView } from './views/SettingsView.jsx';

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState('');
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [featureFlags, setFeatureFlags] = useState(DEFAULT_FEATURE_FLAGS);
  const [saveStatus, setSaveStatus] = useState('Not saved yet');
  const [siteView, setSiteView] = useState('planner');
  const [menuOpen, setMenuOpen] = useState(false);
  const [phaseRemaining, setPhaseRemaining] = useState(DEFAULT_SETTINGS.phases[0].defaultMinutes * 60);
  const [phaseRunning, setPhaseRunning] = useState(false);
  const [taskTimers, setTaskTimers] = useState({});
  const browserTimeZone = getBrowserTimeZone();
  const todayKey = getDateKey(settings.preferences?.timeZone || browserTimeZone);
  const [checkInDone, setCheckInDone] = useState(false);
  const [collapsedPhases, setCollapsedPhases] = useState(
    () => new Set(DEFAULT_SETTINGS.phases.map((p) => p.id).filter((id) => id !== DEFAULT_SETTINGS.activePhaseId))
  );
  const [quickAddInputs, setQuickAddInputs] = useState({});
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMinutes, setEditMinutes] = useState('');
  const [setupDraft, setSetupDraft] = useState({});
  const [routineOverridden, setRoutineOverridden] = useState(false);
  const [templateAddInputs, setTemplateAddInputs] = useState({});
  const [locationStatus, setLocationStatus] = useState('');
  const [mindContext, setMindContext] = useState({ loading: false, data: null, error: '' });
  const [mindAction, setMindAction] = useState('');
  const [dayCheck, setDayCheck] = useState(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [wakeHour, setWakeHour] = useState(null);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [adminSummary, setAdminSummary] = useState({ flags: DEFAULT_FEATURE_FLAGS, metrics: null, recentEvents: [] });
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminQuery, setAdminQuery] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminStatus, setAdminStatus] = useState('');
  const [authForm, setAuthForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });
  const phaseIntervalRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const menuRef = useRef(null);
  const loadedSettingsRef = useRef(false);
  const locationTriedRef = useRef(false);

  const activePhase = useMemo(
    () => settings.phases.find((phase) => phase.id === settings.activePhaseId) ?? settings.phases[0],
    [settings]
  );

  const isFeatureEnabled = (key) => featureFlags.find((flag) => flag.key === key)?.enabled ?? true;

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
        setFeatureFlags(data.featureFlags ?? DEFAULT_FEATURE_FLAGS);
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
    if (!user) {
      setCheckInDone(false);
      setDayCheck(null);
      setWakeHour(null);
      setRoutineOverridden(false);
      return;
    }

    const checkInKey = storageKeyForUser(user.id, `checkInDone:${todayKey}`);
    const dayCheckKey = storageKeyForUser(user.id, `dayCheck:${todayKey}`);
    const wakeHourKey = storageKeyForUser(user.id, `wakeHour:${todayKey}`);
    const storedWakeHour = window.localStorage.getItem(wakeHourKey);
    const parsedWakeHour = storedWakeHour === null ? null : Number(storedWakeHour);

    setCheckInDone(window.localStorage.getItem(checkInKey) === 'true');
    setDayCheck(window.localStorage.getItem(dayCheckKey) ?? null);
    setWakeHour(Number.isFinite(parsedWakeHour) ? parsedWakeHour : null);
    setRoutineOverridden(false);
  }, [todayKey, user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    function onWindowError(event) {
      reportClientError(
        String(event.message ?? 'Unhandled window error'),
        event.error?.stack ?? null,
        'window.error'
      );
    }

    function onUnhandledRejection(event) {
      const reason = event.reason;
      reportClientError(
        String(reason?.message ?? reason ?? 'Unhandled promise rejection'),
        reason?.stack ?? null,
        'window.unhandledrejection'
      );
    }

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [user]);

  useEffect(() => {
    if (!activePhase) {
      return;
    }
    setPhaseRemaining(activePhase.defaultMinutes * 60);
    setPhaseRunning(false);
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
    const id = window.setInterval(() => {
      setTaskTimers((current) => {
        if (!Object.values(current).some((t) => t.running)) return current;
        const next = {};
        for (const [taskId, t] of Object.entries(current)) {
          if (t.running && t.seconds > 1) {
            next[taskId] = { ...t, seconds: t.seconds - 1 };
          } else if (t.running) {
            next[taskId] = { ...t, seconds: 0, running: false };
          } else {
            next[taskId] = t;
          }
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

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

  // Auto-expand the active phase whenever it changes (e.g. after settings load from API)
  useEffect(() => {
    setCollapsedPhases((prev) => {
      if (!prev.has(settings.activePhaseId)) return prev;
      const next = new Set(prev);
      next.delete(settings.activePhaseId);
      return next;
    });
  }, [settings.activePhaseId]);

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

  function updateTasksInPhase(phaseId, updater) {
    setSettings((current) => ({
      ...current,
      phases: current.phases.map((phase) =>
        phase.id === phaseId ? { ...phase, tasks: updater(phase.tasks ?? []) } : phase
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
      setFeatureFlags(data.featureFlags ?? DEFAULT_FEATURE_FLAGS);
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
    setFeatureFlags(DEFAULT_FEATURE_FLAGS);
    setAuthMode('login');
    setAuthError('');
    setSaveStatus('Signed out');
  }

  function handleStartPhase() {
    setPhaseRunning(true);
  }

  function handlePausePhase() {
    setPhaseRunning(false);
  }

  function handleResetPhase() {
    setPhaseRunning(false);
    setPhaseRemaining(activePhase.defaultMinutes * 60);
  }

  function toggleTask(phaseId, taskId) {
    updateTasksInPhase(phaseId, (tasks) =>
      tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task))
    );
  }

  function addTaskToPhase(phaseId, title) {
    if (!title.trim()) return;
    updateTasksInPhase(phaseId, (tasks) => [...tasks, createTask(title.trim(), null, 'oneoff')]);
    setQuickAddInputs((current) => ({ ...current, [phaseId]: '' }));
  }

  function addSuggestionTask(phaseId, suggestion) {
    updateTasksInPhase(phaseId, (tasks) => [
      ...tasks,
      createTask(suggestion.title, suggestion.minutes ?? null, 'oneoff'),
    ]);
  }

  function addTemplateTaskToPhase(phaseId, title) {
    if (!title.trim()) return;
    updateTasksInPhase(phaseId, (tasks) => [...tasks, createTask(title.trim(), null, 'template')]);
  }

  function startEditTask(task) {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditMinutes(task.minutes != null ? String(task.minutes) : '');
  }

  function saveEditTask(phaseId, taskId) {
    const title = editTitle.trim();
    if (!title) return;
    const parsedMinutes = Number(editMinutes);
    updateTasksInPhase(phaseId, (tasks) =>
      tasks.map((t) =>
        t.id === taskId
          ? { ...t, title, minutes: Number.isFinite(parsedMinutes) && parsedMinutes > 0 ? parsedMinutes : null }
          : t
      )
    );
    setEditingTaskId(null);
  }

  function cancelEditTask() {
    setEditingTaskId(null);
  }

  function deleteTask(phaseId, taskId) {
    updateTasksInPhase(phaseId, (tasks) => tasks.filter((t) => t.id !== taskId));
  }

  function toggleTaskTimer(taskId, minutes) {
    setTaskTimers((current) => {
      const existing = current[taskId];
      if (existing?.running) {
        return { ...current, [taskId]: { ...existing, running: false } };
      }
      if (existing && existing.seconds > 0) {
        return { ...current, [taskId]: { ...existing, running: true } };
      }
      return { ...current, [taskId]: { seconds: minutes * 60, running: true } };
    });
  }

  function togglePhaseCollapsed(phaseId) {
    setCollapsedPhases((current) => {
      const next = new Set(current);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  }

  function resetTaskTimer(taskId) {
    setTaskTimers((current) => {
      const { [taskId]: _, ...rest } = current;
      return rest;
    });
  }

  function applyRoutineTemplate(nextType) {
    setSettings((current) => ({
      ...current,
      routineType: nextType,
      phases: current.phases.map((phase) => ({
        ...phase,
        tasks: [
          ...phase.tasks.filter((t) => t.type !== 'template'),
          ...getSuggestions(nextType, phase.name).slice(0, 4).map((task) => createTask(task.title, task.minutes, 'template')),
        ],
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


  async function completeFirstSetup() {
    const normalized = settings.phases.map((phase) => {
      const minutes = Number(setupDraft[phase.id]);
      return {
        ...phase,
        defaultMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : phase.defaultMinutes,
      };
    });
    const nextSettings = {
      ...settings,
      phases: normalized,
      preferences: {
        ...(settings.preferences ?? {}),
        setupComplete: true,
        onboardingComplete: true,
      },
    };
    setSettings(nextSettings);
    setSiteView('planner');
    setPhaseRunning(false);
    // Save immediately — don't rely on the debounce so a fast refresh doesn't lose onboardingComplete
    try {
      await api('/api/settings', { method: 'PUT', body: JSON.stringify(nextSettings) });
      setSaveStatus('All changes saved');
    } catch (err) {
      setSaveStatus(err.message);
    }
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

  function triggerDailyReset() {
    setSettings((current) => {
      if (current.preferences?.lastResetDate === todayKey) return current;
      const newPhases = current.phases.map((phase) => ({
        ...phase,
        tasks: (phase.tasks ?? []).flatMap((t) => {
          if (t.type === 'template') return [{ ...t, done: false }];
          if (!t.done) return [{ ...t, carryCount: (t.carryCount || 0) + 1 }];
          return [];
        }),
      }));
      return {
        ...current,
        phases: newPhases,
        preferences: { ...current.preferences, lastResetDate: todayKey },
      };
    });
  }

  function handleCompleteCheckin() {
    triggerDailyReset();
    window.localStorage.setItem(storageKeyForUser(user?.id, `checkInDone:${todayKey}`), 'true');
    setCheckInDone(true);
  }

  function handleSkipCheckin() {
    triggerDailyReset();
    window.localStorage.setItem(storageKeyForUser(user?.id, `checkInDone:${todayKey}`), 'true');
    setCheckInDone(true);
  }

  function handleDayCheck(result) {
    window.localStorage.setItem(storageKeyForUser(user?.id, `dayCheck:${todayKey}`), result);
    setDayCheck(result);
    setRoutineOverridden(false);
    const nextType = result === 'clearly-worse' ? 'integration' : 'session';
    setSettingsPatch({ routineType: nextType });
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

  async function refreshAdminSummary() {
    if (user?.role !== 'admin') {
      return;
    }
    setAdminLoading(true);
    setAdminStatus('');
    try {
      const data = await api('/api/admin/summary');
      setAdminSummary(data);
      setFeatureFlags(data.flags ?? DEFAULT_FEATURE_FLAGS);
    } catch (error) {
      setAdminStatus(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function searchAdminUsers(nextQuery = adminQuery) {
    if (user?.role !== 'admin') {
      return;
    }
    setAdminLoading(true);
    setAdminStatus('');
    try {
      const params = new URLSearchParams();
      if (nextQuery.trim()) {
        params.set('query', nextQuery.trim());
      }
      const data = await api(`/api/admin/users${params.toString() ? `?${params.toString()}` : ''}`);
      setAdminUsers(data.users ?? []);
    } catch (error) {
      setAdminStatus(error.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function toggleFeatureFlag(key, enabled) {
    setAdminStatus('');
    try {
      const data = await api(`/api/admin/flags/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
      setFeatureFlags(data.flags ?? DEFAULT_FEATURE_FLAGS);
      setAdminSummary((current) => ({ ...current, flags: data.flags ?? DEFAULT_FEATURE_FLAGS }));
    } catch (error) {
      setAdminStatus(error.message);
    }
  }

  async function resetUserState(targetUserId) {
    setAdminStatus('');
    try {
      await api(`/api/admin/users/${encodeURIComponent(targetUserId)}/reset`, {
        method: 'POST',
      });
      setAdminStatus('User state reset.');
      await Promise.all([refreshAdminSummary(), searchAdminUsers()]);
    } catch (error) {
      setAdminStatus(error.message);
    }
  }

  useEffect(() => {
    if (siteView === 'admin' && user?.role === 'admin') {
      refreshAdminSummary();
      searchAdminUsers('');
    }
  }, [siteView, user?.role]);

  useEffect(() => {
    if (!isFeatureEnabled('cycle_tracking') && onboardingStep === 1) {
      setOnboardingStep(2);
    }
  }, [onboardingStep, featureFlags]);

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
  const contextHour = mindContext.data?.hour ?? new Date().getHours();
  const greeting = greetingFor(contextPeriod, firstName(user.displayName));
  const weather = mindContext.data?.weather;
  const circadian = circadianWindow(contextHour);
  const cycleInfo = isFeatureEnabled('cycle_tracking') && settings.preferences?.trackCycle
    ? getCyclePhase(settings.preferences.cycleStartDate, settings.preferences.cycleLength)
    : null;
  const cycleTip = getCycleTip(cycleInfo);
  const goals = settings.preferences?.goals ?? [];
  const hoursAwake = wakeHour !== null ? Math.max(0, contextHour - wakeHour) : null;
  const activeProfile = getActiveProfile(hoursAwake, settings.healthState, cycleInfo);
  const proactiveTask = getProactiveTask(contextHour, settings.healthState, cycleInfo, goals, settings.phases, settings.activePhaseId);

  return (
    <div className="app-shell">
      <main className="main-stack">
        <header className="card topbar-card">
          {siteView !== 'planner' ? (
            <div>
              <p className="card-label">Focus Flow</p>
              <h2>{siteView === 'settings' ? 'Settings' : siteView === 'admin' ? 'Admin' : 'Profile'}</h2>
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
            <span
              className={`save-dot ${saveStatus === 'Saving...' ? 'saving' : saveStatus.startsWith('All') ? 'saved' : 'error'}`}
              title={saveStatus}
              aria-label={saveStatus}
            />
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
                  {user.role === 'admin' && (
                    <button className="ghost menu-item" onClick={() => { setSiteView('admin'); setMenuOpen(false); }}>
                      Admin
                    </button>
                  )}
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
          <ProfileView
            user={user}
            settings={settings}
            goals={GOAL_OPTIONS}
            cycleInfo={cycleInfo}
            locationStatus={locationStatus}
            syncLocationNow={syncLocationNow}
            setSiteView={setSiteView}
            setSettings={setSettings}
            isCycleTrackingEnabled={isFeatureEnabled('cycle_tracking')}
          />
        )}

        {siteView === 'admin' && user.role === 'admin' && (
          <AdminView
            user={user}
            adminSummary={adminSummary}
            adminUsers={adminUsers}
            adminQuery={adminQuery}
            adminLoading={adminLoading}
            adminStatus={adminStatus}
            featureFlags={featureFlags}
            setAdminQuery={setAdminQuery}
            refreshAdminSummary={refreshAdminSummary}
            searchAdminUsers={searchAdminUsers}
            toggleFeatureFlag={toggleFeatureFlag}
            resetUserState={resetUserState}
          />
        )}

        {siteView === 'settings' && (
          <SettingsView
            settings={settings}
            routineOptions={ROUTINE_OPTIONS}
            templateAddInputs={templateAddInputs}
            setTemplateAddInputs={setTemplateAddInputs}
            applyRoutineTemplate={applyRoutineTemplate}
            updatePhaseName={updatePhaseName}
            updatePhaseDefault={updatePhaseDefault}
            setSettingsPatch={setSettingsPatch}
            deleteTask={deleteTask}
            addTemplateTaskToPhase={addTemplateTaskToPhase}
            insertPhaseAt={insertPhaseAt}
          />
        )}

        {siteView === 'planner' && !settings.preferences?.onboardingComplete && (
          <OnboardingFlow
            onboardingStep={onboardingStep}
            settings={settings}
            goals={GOAL_OPTIONS}
            setupDraft={setupDraft}
            setOnboardingStep={setOnboardingStep}
            setSettings={setSettings}
            setSetupDraft={setSetupDraft}
            completeFirstSetup={completeFirstSetup}
            isCycleTrackingEnabled={isFeatureEnabled('cycle_tracking')}
          />
        )}

        {siteView === 'planner' && settings.preferences?.onboardingComplete && (
          <PlannerView
            user={user}
            settings={settings}
            activePhase={activePhase}
            taskTimers={taskTimers}
            editingTaskId={editingTaskId}
            editTitle={editTitle}
            editMinutes={editMinutes}
            collapsedPhases={collapsedPhases}
            quickAddInputs={quickAddInputs}
            checkInDone={checkInDone}
            wakeHour={wakeHour}
            dayCheck={dayCheck}
            routineOverridden={routineOverridden}
            mindContext={mindContext}
            mindAction={mindAction}
            profileExpanded={profileExpanded}
            phaseRemaining={phaseRemaining}
            phaseRunning={phaseRunning}
            todayKey={todayKey}
            greeting={greeting}
            weather={weather}
            circadian={circadian}
            cycleInfo={cycleInfo}
            cycleTip={cycleTip}
            activeProfile={activeProfile}
            proactiveTask={proactiveTask}
            setSettingsPatch={setSettingsPatch}
            setWakeHour={setWakeHour}
            setProfileExpanded={setProfileExpanded}
            setQuickAddInputs={setQuickAddInputs}
            setEditTitle={setEditTitle}
            setEditMinutes={setEditMinutes}
            togglePhaseCollapsed={togglePhaseCollapsed}
            handleStartPhase={handleStartPhase}
            handlePausePhase={handlePausePhase}
            handleResetPhase={handleResetPhase}
            toggleTask={toggleTask}
            toggleTaskTimer={toggleTaskTimer}
            resetTaskTimer={resetTaskTimer}
            startEditTask={startEditTask}
            saveEditTask={saveEditTask}
            cancelEditTask={cancelEditTask}
            deleteTask={deleteTask}
            addTaskToPhase={addTaskToPhase}
            addSuggestionTask={addSuggestionTask}
            suggestNextAction={suggestNextAction}
            handleSkipCheckin={handleSkipCheckin}
            handleDayCheck={handleDayCheck}
            handleCompleteCheckin={handleCompleteCheckin}
            isFeatureEnabled={isFeatureEnabled}
            setRoutineOverridden={setRoutineOverridden}
          />
        )}
      </main>
    </div>
  );
}
