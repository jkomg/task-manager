export const GOAL_OPTIONS = [
  { key: 'writing', label: 'Writing' },
  { key: 'language', label: 'Language learning' },
  { key: 'deep-focus', label: 'Deep focus' },
  { key: 'health', label: 'Health & movement' },
  { key: 'admin', label: 'Admin & life tasks' },
  { key: 'study', label: 'Study & research' },
  { key: 'creative', label: 'Creative projects' },
];

export const HEALTH_OPTIONS = [
  { key: 'steady', label: 'Steady', guidance: 'Keep momentum with one clear next step and low friction.' },
  { key: 'scattered', label: 'Scattered', guidance: 'Shrink scope and use shorter timed blocks with visible boundaries.' },
  { key: 'drained', label: 'Drained', guidance: 'Choose lighter tasks, reduce transitions, and protect recovery.' },
];

export const ROUTINE_OPTIONS = [
  { key: 'session', label: 'Session Day', note: 'Full rhythm with generative work and structured recovery blocks.' },
  { key: 'integration', label: 'Integration Day', note: 'Lighter rhythm for regulation, review, and maintenance.' },
];

export const DEFAULT_FEATURE_FLAGS = [
  { key: 'daily_check_in', enabled: true, description: 'Show the daily wake-time and body-state check-in flow.' },
  { key: 'mind_context', enabled: true, description: 'Show weather, circadian context, and related recommendations.' },
  { key: 'cycle_tracking', enabled: true, description: 'Allow cycle tracking and cycle-aware recommendations.' },
  { key: 'task_timers', enabled: true, description: 'Allow per-task nested timers inside phases.' },
  { key: 'proactive_suggestions', enabled: true, description: 'Show proactive task recommendations after check-in.' },
];

export const TASK_LIBRARY = {
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

export const DEFAULT_SETTINGS = {
  phases: [
    {
      id: 'phase-1',
      name: 'Quiet Window',
      defaultMinutes: 90,
      tasks: [
        { id: 'task-1', title: 'Body scan + jaw check', done: false, minutes: 3, type: 'template', carryCount: 0 },
        { id: 'task-2', title: 'Input reading', done: false, minutes: 25, type: 'template', carryCount: 0 },
        { id: 'task-3', title: 'Capture ideas in notebook', done: false, minutes: 10, type: 'template', carryCount: 0 },
        { id: 'task-4', title: 'Spanish primer', done: false, minutes: 20, type: 'template', carryCount: 0 },
      ],
    },
    {
      id: 'phase-2',
      name: 'Activation Bridge',
      defaultMinutes: 60,
      tasks: [
        { id: 'task-5', title: 'Compost existing captures', done: false, minutes: 20, type: 'template', carryCount: 0 },
        { id: 'task-6', title: 'Light writing touch', done: false, minutes: 25, type: 'template', carryCount: 0 },
        { id: 'task-7', title: 'Spanish mid-touch', done: false, minutes: 15, type: 'template', carryCount: 0 },
      ],
    },
    {
      id: 'phase-3',
      name: 'Deep Window',
      defaultMinutes: 150,
      tasks: [
        { id: 'task-8', title: 'Deep writing block (Draft or Revise)', done: false, minutes: 50, type: 'template', carryCount: 0 },
        { id: 'task-9', title: 'Reading as writer (craft study)', done: false, minutes: 25, type: 'template', carryCount: 0 },
        { id: 'task-10', title: 'Admin sweep', done: false, minutes: 20, type: 'template', carryCount: 0 },
      ],
    },
    {
      id: 'phase-4',
      name: 'Body + Recovery',
      defaultMinutes: 120,
      tasks: [
        { id: 'task-11', title: 'Rehab movement set', done: false, minutes: 30, type: 'template', carryCount: 0 },
        { id: 'task-12', title: 'Legs up / restorative break', done: false, minutes: 15, type: 'template', carryCount: 0 },
        { id: 'task-13', title: 'Capture one sentence', done: false, minutes: 5, type: 'template', carryCount: 0 },
      ],
    },
    {
      id: 'phase-5',
      name: 'Afternoon Drift',
      defaultMinutes: 120,
      tasks: [
        { id: 'task-14', title: 'System review + tomorrow setup', done: false, minutes: 15, type: 'template', carryCount: 0 },
        { id: 'task-15', title: 'Light Spanish', done: false, minutes: 20, type: 'template', carryCount: 0 },
        { id: 'task-16', title: 'Wind-down routine', done: false, minutes: 30, type: 'template', carryCount: 0 },
      ],
    },
  ],
  activePhaseId: 'phase-1',
  healthState: 'steady',
  routineType: 'session',
  preferences: {
    setupComplete: false,
    onboardingComplete: false,
    timeZone: 'UTC',
    location: null,
    goals: [],
    trackCycle: false,
    cycleStartDate: null,
    cycleLength: 28,
    lastResetDate: null,
  },
};
