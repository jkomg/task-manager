import crypto from 'node:crypto';

export const HEALTH_OPTIONS = ['steady', 'scattered', 'drained'];

export function buildDefaultState() {
  return {
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
}

export function normalizeState(input) {
  const fallback = buildDefaultState();

  if (!input || typeof input !== 'object') {
    return fallback;
  }

  const phases = Array.isArray(input.phases)
    ? input.phases
        .filter((phase) => phase && typeof phase === 'object')
        .map((phase) => ({
          id: String(phase.id ?? `phase-${crypto.randomUUID()}`),
          name: String(phase.name ?? 'Untitled phase'),
          defaultMinutes: Number.isFinite(Number(phase.defaultMinutes)) && Number(phase.defaultMinutes) > 0
            ? Number(phase.defaultMinutes)
            : 60,
          tasks: Array.isArray(phase.tasks)
            ? phase.tasks
                .filter((task) => task && typeof task === 'object')
                .map((task) => ({
                  id: String(task.id ?? `task-${crypto.randomUUID()}`),
                  title: String(task.title ?? 'Untitled task'),
                  done: Boolean(task.done),
                  minutes:
                    Number.isFinite(Number(task.minutes)) && Number(task.minutes) > 0
                      ? Number(task.minutes)
                      : null,
                }))
            : [],
        }))
    : fallback.phases;

  const firstPhaseId = phases[0]?.id ?? fallback.activePhaseId;

  return {
    phases: phases.length > 0 ? phases : fallback.phases,
    activePhaseId: phases.some((phase) => phase.id === input.activePhaseId)
      ? input.activePhaseId
      : firstPhaseId,
    healthState: HEALTH_OPTIONS.includes(input.healthState) ? input.healthState : fallback.healthState,
    routineType: input.routineType === 'integration' ? 'integration' : 'session',
    preferences: {
      setupComplete: Boolean(input.preferences?.setupComplete),
      timeZone:
        typeof input.preferences?.timeZone === 'string' && input.preferences.timeZone.trim()
          ? input.preferences.timeZone
          : fallback.preferences.timeZone,
      location:
        Number.isFinite(Number(input.preferences?.location?.latitude)) &&
        Number.isFinite(Number(input.preferences?.location?.longitude))
          ? {
              latitude: Number(input.preferences.location.latitude),
              longitude: Number(input.preferences.location.longitude),
            }
          : null,
    },
  };
}
