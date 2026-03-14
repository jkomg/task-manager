import crypto from 'node:crypto';

export const HEALTH_OPTIONS = ['steady', 'scattered', 'drained'];

export function buildDefaultState() {
  return {
    phases: [
      {
        id: 'phase-1',
        name: 'Morning',
        defaultMinutes: 180,
        tasks: [
          { id: 'task-1', title: 'Body scan + quiet input block', done: false, minutes: 25 },
          { id: 'task-2', title: 'Capture and organize priorities', done: false, minutes: 10 },
        ],
      },
      {
        id: 'phase-2',
        name: 'Afternoon',
        defaultMinutes: 180,
        tasks: [
          { id: 'task-3', title: 'Deep work / writing block', done: false, minutes: 50 },
          { id: 'task-4', title: 'Admin and recovery transitions', done: false, minutes: 20 },
        ],
      },
      {
        id: 'phase-3',
        name: 'Evening',
        defaultMinutes: 180,
        tasks: [
          { id: 'task-5', title: 'System review and reset', done: false, minutes: 15 },
          { id: 'task-6', title: 'Wind-down routine', done: false, minutes: 30 },
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
