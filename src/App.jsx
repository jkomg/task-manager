import { Component, useEffect, useMemo, useRef, useState } from 'react';

const GOAL_OPTIONS = [
  { key: 'writing', label: 'Writing' },
  { key: 'language', label: 'Language learning' },
  { key: 'deep-focus', label: 'Deep focus' },
  { key: 'health', label: 'Health & movement' },
  { key: 'admin', label: 'Admin & life tasks' },
  { key: 'study', label: 'Study & research' },
  { key: 'creative', label: 'Creative projects' },
];

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

  if (isQuiet) {
    if (healthState === 'drained' || healthState === 'scattered') return 'Capture';
    return 'Study';
  }
  if (isActivation) {
    if (healthState === 'drained') return 'Capture';
    if (healthState === 'scattered') return 'Capture';
    return 'Compost';
  }
  if (isDeep) {
    if (healthState === 'drained') return 'Study';
    if (healthState === 'scattered') return 'Compost';
    return 'Draft';
  }
  if (isBody) {
    if (healthState === 'drained') return 'Capture';
    return 'Capture';
  }
  if (isEvening) {
    if (healthState === 'drained') return 'Capture';
    if (healthState === 'scattered') return 'Capture';
    return 'Revise';
  }
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

function createTask(title, minutes = null, type = 'oneoff') {
  const uuid = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id: `task-${uuid}`,
    title,
    done: false,
    minutes,
    type,
    carryCount: 0,
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

function circadianWindow(hour) {
  if (hour >= 5 && hour < 8) return {
    label: 'Cortisol Awakening Response',
    body: 'Cortisol peaks in the first 30–60 min after waking. Core body temperature is rising. This is your sharpest window for orienting to the day — don\'t waste it on email.',
    cognitive: 'Plan, set intentions, read. Avoid high-stakes decisions in the first 30 min.',
    light: 'Bright outdoor or window light right now is the single highest-leverage circadian action.',
  };
  if (hour >= 8 && hour < 11) return {
    label: 'Rising Alertness',
    body: 'Alertness and working memory are climbing. Core body temperature is rising steadily. New information sticks best in this window.',
    cognitive: 'Strong window for input, analysis, and focused reading. Good for Spanish study or craft work.',
    light: 'Stay in well-lit spaces. Dim rooms blunt alertness.',
  };
  if (hour >= 11 && hour < 13) return {
    label: 'Cognitive Peak',
    body: 'Peak working memory and processing speed for most people. Reaction time is highest. This is the narrowest and most valuable generative window.',
    cognitive: 'Reserve this for your hardest creative or analytical task. Draft, revise, or solve — don\'t fill it with admin.',
    light: null,
  };
  if (hour >= 13 && hour < 15) return {
    label: 'Post-Lunch Dip',
    body: 'A mild circadian trough — normal and predictable, not a sign of weakness. Alertness drops, especially after a meal. A 10–20 min rest here is restorative and won\'t hurt night sleep.',
    cognitive: 'Reduce friction. Admin, light revision, or a short rest before the second wind.',
    light: null,
  };
  if (hour >= 15 && hour < 18) return {
    label: 'Second Wind',
    body: 'Core body temperature peaks along with motor coordination and reaction time. Muscle strength is at its daily high. This window often surprises people who thought they were done for the day.',
    cognitive: 'Good for physical work, structured revision, Spanish, or anything requiring motor precision.',
    light: null,
  };
  if (hour >= 18 && hour < 21) return {
    label: 'Wind-Down Begins',
    body: 'Melatonin will begin rising within 1–2 hours. Core body temperature starts to fall. High-intensity cognitive work becomes harder to sustain.',
    cognitive: 'Review, light admin, gentle planning for tomorrow. Protect this window — late pushes borrow from recovery.',
    light: 'Reduce bright overhead light. Warmer tones support earlier melatonin onset.',
  };
  if (hour >= 21 || hour < 5) return {
    label: 'Melatonin Window',
    body: 'Melatonin is elevated. Core body temperature is falling. Sleep pressure is building. This is biology working as intended.',
    cognitive: 'Wind-down only — journaling, light reading, or settling. Bright screens delay sleep onset by 30–60 min.',
    light: 'Dim or candlelight level. Blue-light screens now cost you tomorrow.',
  };
  return {
    label: 'Rest Phase',
    body: 'Deep recovery. Growth hormone is active, memory consolidation is running. Rest is the task.',
    cognitive: null,
    light: null,
  };
}

function toF(c) {
  return Math.round(c * 9 / 5 + 32);
}

// Returns the circadian window key based on hours since waking.
// Windows are relative to wake time, not clock time — accounts for ADHD's
// ~90-minute delayed circadian phase (Kooij et al., 2025).
function getCircadianWindowKey(hoursAwake) {
  if (hoursAwake < 1.5) return 'car';        // cortisol awakening response
  if (hoursAwake < 4.5) return 'rising';     // alertness climbing
  if (hoursAwake < 7)   return 'peak';       // cognitive peak
  if (hoursAwake < 9)   return 'trough';     // natural alertness dip
  if (hoursAwake < 12)  return 'secondWind'; // body temp peak
  if (hoursAwake < 15)  return 'windDown';   // melatonin onset approaching
  return 'melatonin';
}

// Named context profiles: each one is a specific combination of circadian
// window + health state + cycle phase. Plain-language explanations only —
// no jargon, no verdict. Sources linked so users can go deeper.
const ADHD_PROFILES = {
  softStart: {
    name: 'Soft Start',
    tagline: 'Cortisol is rising — easy does it for the first hour or two.',
    detail: 'Cortisol peaks in the first 30–60 minutes after waking and helps orient you to the day. ADHD brains typically show a slower, delayed cortisol rise than neurotypical brains — so the "waking up" window often runs longer. Input, reading, and orientation work well here. High-stakes decisions or new generative work tend to cost more than they return this early.',
    sources: [
      { title: 'ADHD as a circadian rhythm disorder (Kooij et al., 2025)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12728042/' },
      { title: 'Delayed circadian rhythm in adults with ADHD (Van Veen et al., 2010)', url: 'https://pubmed.ncbi.nlm.nih.gov/20163790/' },
    ],
    taskTypes: ['capture', 'study', 'short'],
    blockMinutes: 20,
  },
  gentleStart: {
    name: 'Gentle Start',
    tagline: 'Lower hormonal support plus early window — start light and build.',
    detail: 'Estrogen and progesterone are both low right now, which reduces dopamine availability at the same time your brain is still warming up. Research shows that ADHD symptoms — particularly inattention — are measurably higher when estrogen is low, because estrogen directly supports dopamine synthesis and reuptake. Capture and gentle input are the most natural fit. Save generative work for later when your window opens.',
    sources: [
      { title: 'Reproductive steroids and ADHD symptoms across the menstrual cycle (Robison et al., 2018)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5803442/' },
      { title: 'ADHD and the menstrual cycle: theory and evidence (Petrovic et al., 2024)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10872410/' },
    ],
    taskTypes: ['capture', 'short'],
    blockMinutes: 15,
  },
  risingCapacity: {
    name: 'Rising Capacity',
    tagline: 'Working memory is building — good for absorbing and input-style work.',
    detail: 'Alertness and working memory climb steadily in the first few hours after waking. Because ADHD\'s circadian phase runs roughly 90 minutes later than average, this window often arrives later in the day than neurotypical schedules assume — which is why mornings can feel sluggish even after enough sleep. Study, reading, and structured input tend to land well here.',
    sources: [
      { title: 'ADHD as a circadian rhythm disorder (Kooij et al., 2025)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12728042/' },
    ],
    taskTypes: ['study', 'capture', 'admin'],
    blockMinutes: 25,
  },
  strongInput: {
    name: 'Strong Input Window',
    tagline: 'Rising estrogen is supporting your focus — good time to absorb and build.',
    detail: 'You\'re in a rising estrogen phase, which promotes dopamine synthesis and improves working memory and sustained attention. Paired with your alertness window, this is a strong time for study, structured reading, and language work. Generative output tends to land a bit later as your cognitive peak arrives.',
    sources: [
      { title: 'Menstrual cycle-related hormonal fluctuations in ADHD (MDPI, 2025)', url: 'https://www.mdpi.com/2077-0383/15/1/121' },
      { title: 'ADHD as a circadian rhythm disorder (Kooij et al., 2025)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12728042/' },
    ],
    taskTypes: ['study', 'creative', 'capture'],
    blockMinutes: 30,
  },
  lightInput: {
    name: 'Light Input',
    tagline: 'Alertness building, but lower hormonal support — keep tasks absorptive.',
    detail: 'Your alertness is climbing, but lower estrogen right now means less dopamine support than usual. Study and input-style tasks fit better here than generative output. Your brain is still capable — this is just context so you can set realistic expectations and pick tasks that work with what\'s available.',
    sources: [
      { title: 'ADHD and the menstrual cycle: theory and evidence (Petrovic et al., 2024)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10872410/' },
    ],
    taskTypes: ['study', 'capture', 'short'],
    blockMinutes: 20,
  },
  highCapacity: {
    name: 'High Capacity',
    tagline: 'Cognitive window is open and hormonal support is strong.',
    detail: 'You\'re in your circadian peak window — roughly 4.5–7 hours after waking, where working memory and processing speed are highest for most people. Estrogen is actively supporting dopamine right now, which helps with sustained attention and task initiation. This is when generative work, drafting, and harder analytical tasks tend to cost the least effort.',
    sources: [
      { title: 'Time of day and chronotype in cognitive function (Blatter & Cajochen, 2023)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10683050/' },
      { title: 'Menstrual cycle-related hormonal fluctuations in ADHD (MDPI, 2025)', url: 'https://www.mdpi.com/2077-0383/15/1/121' },
    ],
    taskTypes: ['creative', 'long', 'study'],
    blockMinutes: 50,
  },
  creativeWindow: {
    name: 'Cognitive Window',
    tagline: 'Your peak focus window — good for the work that matters most today.',
    detail: 'Roughly 4.5–7 hours after waking is where working memory and processing speed tend to peak. Because ADHD\'s circadian phase runs ~90 minutes later than neurotypical, this window often arrives in the early-to-mid afternoon rather than mid-morning. Generative and analytical work fits here — drafting, problem-solving, anything requiring sustained executive function.',
    sources: [
      { title: 'ADHD as a circadian rhythm disorder (Kooij et al., 2025)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12728042/' },
      { title: 'Time of day and chronotype in cognitive function (Blatter & Cajochen, 2023)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10683050/' },
    ],
    taskTypes: ['creative', 'long', 'study'],
    blockMinutes: 45,
  },
  constrainedPeak: {
    name: 'Constrained Peak',
    tagline: 'Focus window is open, but hormonal support is lower — shorter blocks help.',
    detail: 'This is your cognitive peak circadian window, but lower estrogen and progesterone are reducing dopamine availability — which ADHD already affects. Research shows stimulant medication is measurably less effective in the pre-menstrual phase, meaning the gap between intention and execution is wider than usual. You can still do meaningful work; it may just cost more friction than on other days. That\'s documented biology, not a personal failing.',
    sources: [
      { title: 'ADHD and the menstrual cycle: theory and evidence (Petrovic et al., 2024)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10872410/' },
      { title: 'Female-specific pharmacotherapy in ADHD: premenstrual adjustment (PMC, 2024)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10751335/' },
    ],
    taskTypes: ['creative', 'study', 'short'],
    blockMinutes: 25,
  },
  microSprint: {
    name: 'Micro-Sprint Mode',
    tagline: 'Short bursts tend to work better than long blocks when attention is fragmented.',
    detail: 'When attention is scattered, longer blocks often produce frustration rather than output — not because you can\'t do the work, but because the scope makes starting harder. Shorter, timed sprints (15–20 min) with one clear outcome lower the initiation cost. Switching between tasks when momentum stalls can also help sustain engagement, since novelty activates dopamine pathways. There\'s no single right pattern — use what keeps you moving.',
    sources: [
      { title: 'Task switching and attention deficit hyperactivity disorder (Cepeda et al., 2000)', url: 'https://pubmed.ncbi.nlm.nih.gov/10885680/' },
      { title: 'The paradox of task switching in ADHD (OSF preprint)', url: 'https://sciety.org/articles/activity/10.31234/osf.io/mhrba_v1' },
    ],
    taskTypes: ['short', 'admin', 'capture'],
    blockMinutes: 15,
  },
  lowBattery: {
    name: 'Low Battery',
    tagline: 'Working with reduced capacity — protect your energy, not your to-do list.',
    detail: 'When energy is low, pushing harder rarely works and often makes things worse. Lighter cognitive tasks, short blocks, and movement breaks tend to preserve more functional capacity than forcing through. A 10-minute movement break has documented acute benefits for ADHD attention — often more than an equivalent amount of sitting and trying. Capture is almost always available; deep work usually isn\'t today, and that\'s a real constraint not a character flaw.',
    sources: [
      { title: 'Physical exercise in ADHD: evidence and implications (Mehren et al., 2020)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6945516/' },
      { title: 'Effects of acute exercise on executive functions in adults with ADHD (ScienceDirect, 2026)', url: 'https://www.sciencedirect.com/science/article/abs/pii/S1469029226000282' },
    ],
    taskTypes: ['capture', 'short', 'movement', 'admin'],
    blockMinutes: 10,
  },
  heavyDay: {
    name: 'Heavy Day',
    tagline: 'Low energy and lower hormonal support today — one meaningful thing is enough.',
    detail: 'The combination of low energy and the pre-menstrual hormonal shift — falling estrogen and progesterone — is documented as one of the harder ADHD days. Research shows stimulant medication is less effective in this phase because progesterone interferes with its action, which means the gap between what you intend to do and what actually happens is wider than usual. This isn\'t a willpower issue. One meaningful thing today is genuinely enough.',
    sources: [
      { title: 'ADHD and the menstrual cycle: theory and evidence (Petrovic et al., 2024)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10872410/' },
      { title: 'Reproductive steroids and ADHD symptoms across the menstrual cycle (Robison et al., 2018)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5803442/' },
      { title: 'Female-specific pharmacotherapy in ADHD: premenstrual adjustment (PMC, 2024)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10751335/' },
    ],
    taskTypes: ['short', 'capture', 'movement'],
    blockMinutes: 10,
  },
  recoveryTrough: {
    name: 'Alertness Trough',
    tagline: 'A natural dip — movement or rest here recovers more than pushing through.',
    detail: 'Roughly 7–9 hours after waking, alertness naturally dips — this is a circadian pattern driven by biology, not sleep debt or weakness. It happens even without eating. Research shows a 10-minute movement break at this point restores ADHD-relevant attention for roughly 45–60 minutes afterward, more reliably than forcing cognitive work. A short rest is also legitimate and doesn\'t hurt night sleep.',
    sources: [
      { title: 'Physical exercise in ADHD: evidence and implications (Mehren et al., 2020)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6945516/' },
      { title: 'Effects of acute exercise on executive functions in adults with ADHD (ScienceDirect, 2026)', url: 'https://www.sciencedirect.com/science/article/abs/pii/S1469029226000282' },
    ],
    taskTypes: ['movement', 'admin', 'short', 'capture'],
    blockMinutes: 15,
  },
  secondWindStrong: {
    name: 'Second Wind — Strong',
    tagline: 'Body temp peak and good hormonal support — structured work fits well here.',
    detail: 'Core body temperature and motor coordination peak roughly 9–12 hours after waking. With estrogen currently supporting dopamine, this is a reliable window for revision, language study, structured analytical work, and anything requiring sustained precision. Different from the cognitive peak earlier — less raw generative power, more organized and sustained.',
    sources: [
      { title: 'Time of day and chronotype in cognitive function (Blatter & Cajochen, 2023)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10683050/' },
      { title: 'Menstrual cycle-related hormonal fluctuations in ADHD (MDPI, 2025)', url: 'https://www.mdpi.com/2077-0383/15/1/121' },
    ],
    taskTypes: ['study', 'admin', 'creative'],
    blockMinutes: 35,
  },
  secondWind: {
    name: 'Second Wind',
    tagline: 'A reliable window for structured tasks — revision, language, admin.',
    detail: 'Body temperature peaks roughly 9–12 hours after waking, along with motor coordination. This is a good window for revision, language practice, admin, and structured review — not a second cognitive peak, but a reliable period of organized, sustained alertness. Many ADHD users find afternoon and evening their most functional window, which aligns with the ~90-minute circadian phase delay.',
    sources: [
      { title: 'ADHD as a circadian rhythm disorder (Kooij et al., 2025)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12728042/' },
      { title: 'Time of day and chronotype in cognitive function (Blatter & Cajochen, 2023)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10683050/' },
    ],
    taskTypes: ['study', 'admin', 'capture'],
    blockMinutes: 30,
  },
  settleIn: {
    name: 'Settling',
    tagline: 'Melatonin is starting to rise — a natural time to wrap up and capture.',
    detail: 'About 12–15 hours after waking, melatonin begins rising and core body temperature starts falling. Generative cognitive work becomes harder to sustain, and this is a natural transition point. Capture, planning tomorrow, and light review all fit well. Evening hyperfocus is a documented ADHD pattern — if that\'s relevant to you, this is a useful moment to note a stopping intention before it kicks in.',
    sources: [
      { title: 'Hyperfocus: the forgotten frontier of attention (Ashinoff & Abu-Akel, 2021)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7851038/' },
      { title: 'ADHD as a circadian rhythm disorder (Kooij et al., 2025)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12728042/' },
    ],
    taskTypes: ['capture', 'admin', 'short'],
    blockMinutes: 15,
  },
  restSignal: {
    name: 'Rest Window',
    tagline: 'Melatonin is active — your body is signaling wind-down.',
    detail: 'Melatonin elevation signals sleep onset and is a biological cue, not a suggestion. Sleep consolidates memory and resets the dopamine and norepinephrine systems that ADHD affects daily. If you\'re still working now, the return diminishes quickly and the cost to tomorrow\'s functional capacity is real.',
    sources: [
      { title: 'ADHD as a circadian rhythm disorder (Kooij et al., 2025)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12728042/' },
    ],
    taskTypes: ['short', 'capture'],
    blockMinutes: 10,
  },
};

function getActiveProfile(hoursAwake, healthState, cycleInfo) {
  if (hoursAwake === null || hoursAwake === undefined) return null;
  const win = getCircadianWindowKey(hoursAwake);
  const cycleLow = cycleInfo?.phase === 'menstrual' || cycleInfo?.phase === 'luteal-late';
  const cycleHigh = cycleInfo?.phase === 'follicular' || cycleInfo?.phase === 'ovulatory';

  if (win === 'melatonin') return ADHD_PROFILES.restSignal;
  if (win === 'windDown')  return ADHD_PROFILES.settleIn;

  if (healthState === 'drained') return cycleLow ? ADHD_PROFILES.heavyDay : ADHD_PROFILES.lowBattery;
  if (healthState === 'scattered') return ADHD_PROFILES.microSprint;

  // Steady below here
  if (win === 'trough')     return ADHD_PROFILES.recoveryTrough;
  if (win === 'car')        return cycleLow ? ADHD_PROFILES.gentleStart : ADHD_PROFILES.softStart;
  if (win === 'rising')     return cycleHigh ? ADHD_PROFILES.strongInput : cycleLow ? ADHD_PROFILES.lightInput : ADHD_PROFILES.risingCapacity;
  if (win === 'peak')       return cycleHigh ? ADHD_PROFILES.highCapacity : cycleLow ? ADHD_PROFILES.constrainedPeak : ADHD_PROFILES.creativeWindow;
  if (win === 'secondWind') return cycleHigh ? ADHD_PROFILES.secondWindStrong : ADHD_PROFILES.secondWind;
  return ADHD_PROFILES.creativeWindow;
}

// Infer what type of task this is from its title and duration.
// Used for subtle fit indicators — not prescriptive, just informational.
function inferTaskTypes(task) {
  const t = task.title.toLowerCase();
  const types = new Set();
  if (/writ|draft|creat|essay|chapter|blog|post|story|compost/.test(t)) types.add('creative');
  if (/spanish|french|german|japanese|language|vocab|grammar/.test(t)) types.add('study');
  if (/read|study|research|annotate|craft|input|primer/.test(t)) types.add('study');
  if (/admin|email|invoice|call|meeting|schedule|review|plan|sweep|setup|system/.test(t)) types.add('admin');
  if (/capture|note|idea|journal|jot|sentence/.test(t)) types.add('capture');
  if (/walk|run|mov|stretch|exercise|rehab|yoga|swim|bike|body|toe|legs up|upright/.test(t)) types.add('movement');
  if (task.minutes && task.minutes <= 15) types.add('short');
  if (task.minutes && task.minutes >= 30) types.add('long');
  return types;
}

function getTaskFit(task, profile) {
  if (!profile?.taskTypes?.length || task.done) return 0;
  const types = inferTaskTypes(task);
  let score = 0;
  for (const type of types) {
    if (profile.taskTypes.includes(type)) score++;
  }
  return score;
}

function getDynamicLightRec(hour, weather, healthState, cycleInfo) {
  if (!weather) return null;
  const uv = weather.uvNow;
  let base = null;

  if (hour >= 5 && hour < 9) {
    if (uv != null && uv >= 6) {
      base = `UV already ${uv} — morning light through a window or open door works.`;
    } else {
      base = 'Get outside now — morning light is the strongest circadian anchor you have.';
    }
  } else if (hour >= 9 && hour < 12) {
    if (uv != null && uv >= 7) {
      base = `UV is ${uv} — bright indoor or shaded outdoor light works. Keep direct exposure under 10 min.`;
    } else {
      base = `UV ${uv ?? 'low'} — a 10–15 min outdoor break now supports alertness.`;
    }
  } else if (hour >= 16 && hour < 20 && weather.sunset) {
    base = 'Late afternoon light before sunset helps delay melatonin onset — even 10 min outside counts.';
  }

  if (!base) return null;

  if (cycleInfo?.phase === 'follicular' || cycleInfo?.phase === 'ovulatory') {
    base += ' Circadian sensitivity is high in this phase — light is especially effective right now.';
  } else if (cycleInfo?.phase === 'menstrual' || cycleInfo?.phase === 'luteal-late') {
    base += ' Gentle exposure works — no need to push.';
  }

  if (healthState === 'drained') {
    base += ' Even 5 min counts when energy is low.';
  }

  return base;
}

function getCyclePhase(cycleStartDate, cycleLength = 28) {
  if (!cycleStartDate) return null;
  try {
    const start = new Date(cycleStartDate);
    if (isNaN(start.getTime())) return null;
    const today = new Date();
    const daysSinceStart = Math.floor((today - start) / (1000 * 60 * 60 * 24));
    const dayOfCycle = (daysSinceStart % cycleLength) + 1;

    if (dayOfCycle <= 5) return { phase: 'menstrual', day: dayOfCycle, label: 'Menstrual' };
    if (dayOfCycle <= 13) return { phase: 'follicular', day: dayOfCycle, label: 'Follicular' };
    if (dayOfCycle <= 16) return { phase: 'ovulatory', day: dayOfCycle, label: 'Ovulatory' };
    if (dayOfCycle <= 24) return { phase: 'luteal-early', day: dayOfCycle, label: 'Early Luteal' };
    return { phase: 'luteal-late', day: dayOfCycle, label: 'Late Luteal' };
  } catch {
    return null;
  }
}

function getCycleTip(cycleInfo) {
  if (!cycleInfo) return null;
  const tips = {
    'menstrual': 'Energy may be lower today — lighter tasks and rest are valid choices.',
    'follicular': 'Energy is rising — a good window for new ideas and learning.',
    'ovulatory': 'Communication and output tend to peak here. Good time for generative work.',
    'luteal-early': 'Analytical focus is strong. Good for revision, detail work, and organization.',
    'luteal-late': 'Energy may be shifting. Reduce friction where you can.',
  };
  return tips[cycleInfo.phase] ?? null;
}

function getProactiveTask(contextHour, healthState, cycleInfo, goals, phases, activePhaseId) {
  const activePhase = phases?.find((p) => p.id === activePhaseId);
  if (!activePhase) return null;

  const incompleteTasks = (activePhase.tasks ?? []).filter((t) => !t.done);
  if (incompleteTasks.length === 0) return null;

  const scored = incompleteTasks.map((task) => {
    let score = 0;
    const title = task.title.toLowerCase();

    if (healthState === 'drained') {
      if (task.minutes && task.minutes <= 10) score += 3;
      else if (task.minutes && task.minutes <= 20) score += 1;
    } else if (healthState === 'scattered') {
      if (task.minutes) score += 2;
    } else {
      if (task.minutes && task.minutes >= 25) score += 1;
    }

    const window = circadianWindow(contextHour);
    if (window.label === 'Cognitive Peak' || window.label === 'Rising Alertness') {
      if (title.includes('deep') || title.includes('draft') || title.includes('writ')) score += 2;
    } else if (window.label === 'Post-Lunch Dip') {
      if (task.minutes && task.minutes <= 15) score += 2;
      if (title.includes('review') || title.includes('admin') || title.includes('capture')) score += 1;
    }

    if (cycleInfo?.phase === 'menstrual' || cycleInfo?.phase === 'luteal-late') {
      if (task.minutes && task.minutes <= 15) score += 1;
    } else if (cycleInfo?.phase === 'follicular' || cycleInfo?.phase === 'ovulatory') {
      if (title.includes('draft') || title.includes('creat') || title.includes('writ')) score += 1;
    }

    if (goals?.includes('language') && (title.includes('spanish') || title.includes('language'))) score += 2;
    if (goals?.includes('writing') && (title.includes('writ') || title.includes('draft') || title.includes('capture'))) score += 2;
    if (goals?.includes('health') && (title.includes('movement') || title.includes('rehab') || title.includes('body') || title.includes('walk'))) score += 2;

    return { task, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.task ?? null;
}

function greetingFor(period, name) {
  const byPeriod = {
    morning: `Good morning, ${name}`,
    afternoon: `Good afternoon, ${name}`,
    evening: `Good evening, ${name}`,
  };
  return byPeriod[period] ?? `Hi, ${name}`;
}

function formatDateLong() {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
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

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <main className="auth-shell">
          <section className="auth-card">
            <p className="eyebrow">Focus Flow</p>
            <h1>Something went wrong</h1>
            <p className="lede">{String(this.state.error?.message ?? this.state.error)}</p>
            <button onClick={() => this.setState({ error: null })}>Try again</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
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
  const [phaseRemaining, setPhaseRemaining] = useState(DEFAULT_SETTINGS.phases[0].defaultMinutes * 60);
  const [phaseRunning, setPhaseRunning] = useState(false);
  const [taskTimers, setTaskTimers] = useState({});
  const todayKey = new Date().toISOString().slice(0, 10);
  const [checkInDone, setCheckInDone] = useState(
    () => localStorage.getItem('checkInDone') === todayKey
  );
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
  const [dayCheck, setDayCheck] = useState(
    () => localStorage.getItem('dayCheck_' + new Date().toISOString().slice(0, 10)) ?? null
  );
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [wakeHour, setWakeHour] = useState(
    () => { const v = localStorage.getItem('wakeHour_' + new Date().toISOString().slice(0, 10)); return v !== null ? Number(v) : null; }
  );
  const [profileExpanded, setProfileExpanded] = useState(false);
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

  const completionRatio = useMemo(() => {
    const total = activePhase?.tasks?.length ?? 0;
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
    updateTasksInPhase(phaseId, (tasks) => [...tasks, createTask(suggestion.title, null, 'oneoff')]);
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
    localStorage.setItem('checkInDone', todayKey);
    setCheckInDone(true);
  }

  function handleSkipCheckin() {
    triggerDailyReset();
    localStorage.setItem('checkInDone', todayKey);
    setCheckInDone(true);
  }

  function handleDayCheck(result) {
    localStorage.setItem('dayCheck_' + todayKey, result);
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
  const cycleInfo = settings.preferences?.trackCycle
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

            <div style={{ marginTop: '1rem' }}>
              <p className="card-label">Goals</p>
              <div className="goal-grid">
                {GOAL_OPTIONS.map((goal) => (
                  <button
                    key={goal.key}
                    className={`goal-chip ${(settings.preferences?.goals ?? []).includes(goal.key) ? 'active' : 'ghost'}`}
                    onClick={() => {
                      setSettings((s) => {
                        const current = s.preferences?.goals ?? [];
                        const next = current.includes(goal.key)
                          ? current.filter((g) => g !== goal.key)
                          : [...current, goal.key];
                        return { ...s, preferences: { ...(s.preferences ?? {}), goals: next } };
                      });
                    }}
                  >
                    {goal.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <p className="card-label">Cycle tracking</p>
              <div className="button-row" style={{ marginBottom: '0.5rem' }}>
                <button
                  className={settings.preferences?.trackCycle ? 'secondary small' : 'ghost small'}
                  onClick={() => setSettings((s) => ({ ...s, preferences: { ...(s.preferences ?? {}), trackCycle: !s.preferences?.trackCycle } }))}
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
                      onChange={(e) => setSettings((s) => ({ ...s, preferences: { ...(s.preferences ?? {}), cycleStartDate: e.target.value } }))}
                    />
                  </label>
                  <label>
                    Average cycle length (days)
                    <input
                      type="number"
                      min="20"
                      max="45"
                      value={settings.preferences?.cycleLength ?? 28}
                      onChange={(e) => setSettings((s) => ({ ...s, preferences: { ...(s.preferences ?? {}), cycleLength: Number(e.target.value) } }))}
                    />
                  </label>
                  {cycleInfo && (
                    <p className="muted-copy">Current phase: {cycleInfo.label} (day {cycleInfo.day})</p>
                  )}
                </div>
              )}
            </div>

            <div className="button-row" style={{ marginTop: '1rem' }}>
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
                  <div className="settings-template-tasks">
                    <p className="field-label">Repeating tasks</p>
                    {phase.tasks.filter((t) => t.type === 'template').map((task) => (
                      <div key={task.id} className="settings-template-task-row">
                        <span className="settings-template-task-title">{task.title}</span>
                        {task.minutes && <span className="muted-copy">{task.minutes}m</span>}
                        <button className="ghost small danger-text" onClick={() => deleteTask(phase.id, task.id)}>×</button>
                      </div>
                    ))}
                    <form
                      className="settings-template-add"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const val = templateAddInputs[phase.id] ?? '';
                        addTemplateTaskToPhase(phase.id, val);
                        setTemplateAddInputs((cur) => ({ ...cur, [phase.id]: '' }));
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Add repeating task…"
                        value={templateAddInputs[phase.id] ?? ''}
                        onChange={(e) => setTemplateAddInputs((cur) => ({ ...cur, [phase.id]: e.target.value }))}
                      />
                    </form>
                  </div>
                </div>
              ))}
              <button className="secondary" onClick={() => insertPhaseAt(settings.phases.length)}>+ Add phase at end</button>
            </div>
          </section>
        )}

        {siteView === 'planner' && !settings.preferences?.onboardingComplete && (
          <section className="card onboarding-card">
            {onboardingStep === 0 && (
              <>
                <p className="card-label">Welcome to Focus Flow</p>
                <h2>What are you working toward?</h2>
                <p className="lede">Select everything that applies — this helps the app surface the right tasks and timing for you.</p>
                <div className="goal-grid">
                  {GOAL_OPTIONS.map((goal) => (
                    <button
                      key={goal.key}
                      className={`goal-chip ${goals.includes(goal.key) ? 'active' : 'ghost'}`}
                      onClick={() => {
                        setSettings((s) => {
                          const current = s.preferences?.goals ?? [];
                          const next = current.includes(goal.key)
                            ? current.filter((g) => g !== goal.key)
                            : [...current, goal.key];
                          return { ...s, preferences: { ...(s.preferences ?? {}), goals: next } };
                        });
                      }}
                    >
                      {goal.label}
                    </button>
                  ))}
                </div>
                <button className="secondary" style={{ marginTop: '1rem' }} onClick={() => setOnboardingStep(1)}>
                  Continue
                </button>
              </>
            )}

            {onboardingStep === 1 && (
              <>
                <p className="card-label">Optional: hormonal context</p>
                <h2>Do you want to track your cycle?</h2>
                <p className="lede">
                  If you track a menstrual cycle, Focus Flow can offer gentle nudges based on your current phase — no pressure, always optional, and easy to update anytime.
                </p>
                <div className="button-row" style={{ marginTop: '0.5rem' }}>
                  <button
                    className={settings.preferences?.trackCycle ? 'secondary' : 'ghost'}
                    onClick={() => setSettings((s) => ({ ...s, preferences: { ...(s.preferences ?? {}), trackCycle: true } }))}
                  >
                    Yes, track my cycle
                  </button>
                  <button
                    className="ghost"
                    onClick={() => {
                      setSettings((s) => ({ ...s, preferences: { ...(s.preferences ?? {}), trackCycle: false } }));
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
                        onChange={(e) => setSettings((s) => ({ ...s, preferences: { ...(s.preferences ?? {}), cycleStartDate: e.target.value } }))}
                      />
                    </label>
                    <label>
                      Average cycle length (days)
                      <input
                        type="number"
                        min="20"
                        max="45"
                        value={settings.preferences?.cycleLength ?? 28}
                        onChange={(e) => setSettings((s) => ({ ...s, preferences: { ...(s.preferences ?? {}), cycleLength: Number(e.target.value) } }))}
                      />
                    </label>
                    <button className="secondary" onClick={() => setOnboardingStep(2)}>Continue</button>
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
                        onChange={(e) =>
                          setSetupDraft((current) => ({ ...current, [phase.id]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="button-row" style={{ marginTop: '1rem' }}>
                  <button className="secondary" onClick={completeFirstSetup}>Start your day</button>
                  <button className="ghost small" onClick={() => setOnboardingStep(1)}>Back</button>
                </div>
              </>
            )}
          </section>
        )}

        {siteView === 'planner' && settings.preferences?.onboardingComplete && (
          <>
            {/* Greeting + weather + circadian — first card */}
            {(() => {
              const lightRec = getDynamicLightRec(contextHour, weather, settings.healthState, cycleInfo);
              return (
                <div className="context-strip card">
                  <div className="context-strip-top">
                    <div>
                      <span className="context-greeting">{greeting}.</span>
                      <span className="context-date"> {formatDateLong()}</span>
                    </div>
                    {weather ? (
                      <span className="context-weather-inline">
                        {weather.summary} · {toF(weather.temperatureC)}°F
                        {' · '}↑{formatClockFromIso(weather.sunrise, mindContext.data?.timeZone)}
                        {' '}↓{formatClockFromIso(weather.sunset, mindContext.data?.timeZone)}
                        {weather.uvNow != null ? ` · UV ${weather.uvNow}` : ''}
                      </span>
                    ) : mindContext.loading ? (
                      <span className="context-weather-inline muted-copy">Loading…</span>
                    ) : null}
                  </div>

                  {/* Profile: shown when wake time has been set */}
                  {activeProfile ? (
                    <div className="profile-block">
                      <div className="profile-header" onClick={() => setProfileExpanded((x) => !x)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setProfileExpanded((x) => !x)}>
                        <div>
                          <span className="profile-name">{activeProfile.name}</span>
                          <span className="profile-tagline"> — {activeProfile.tagline}</span>
                        </div>
                        <span className="profile-chevron">{profileExpanded ? '▾' : '▸'}</span>
                      </div>
                      {profileExpanded && (
                        <div className="profile-detail">
                          <p className="profile-detail-text">{activeProfile.detail}</p>
                          {activeProfile.sources.length > 0 && (
                            <div className="profile-sources">
                              {activeProfile.sources.map((s) => (
                                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="profile-source-link">
                                  {s.title}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="context-strip-circadian">
                      <strong>{circadian.label}:</strong>{' '}
                      {circadian.cognitive ?? circadian.body}
                    </div>
                  )}

                  {cycleTip && (
                    <div className="context-cycle-tip">
                      {cycleInfo.label} · day {cycleInfo.day} — {cycleTip}
                    </div>
                  )}
                  {lightRec && (
                    <div className="context-light-rec">
                      ☀ {lightRec}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Phase timeline strip */}
            <div className="card phase-map-card">
              {(() => {
                let cumulativeHours = 0;
                return settings.phases.map((phase) => {
                  const startH = cumulativeHours;
                  cumulativeHours += phase.defaultMinutes / 60;
                  const endH = cumulativeHours;
                  const isActive = phase.id === settings.activePhaseId;
                  const openTasks = (phase.tasks ?? []).filter((t) => !t.done).length;
                  const fmtH = (h) => Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
                  return (
                    <button
                      key={phase.id}
                      className={`phase-map-segment ${isActive ? 'active' : ''}`}
                      onClick={() => setSettingsPatch({ activePhaseId: phase.id })}
                    >
                      <span className="phase-map-hours">{fmtH(startH)}–{fmtH(endH)}</span>
                      <span className="phase-map-name">
                        {phase.name}
                        {openTasks > 0 && <span className="phase-map-badge">{openTasks}</span>}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>

            {/* Morning check-in (dismissible) */}
            {!checkInDone && (
              <div className="card check-in-card">
                <div className="check-in-header">
                  <p className="card-label">Check-in</p>
                  <button className="ghost small" onClick={handleSkipCheckin} aria-label="Skip check-in">✕</button>
                </div>

                <p className="check-in-prompt">When did you wake up?</p>
                <div className="day-check-options">
                  {[
                    { label: 'Before 6am', value: 5.5 },
                    { label: '6–7am', value: 6.5 },
                    { label: '7–8am', value: 7.5 },
                    { label: '8–9am', value: 8.5 },
                    { label: '9–10am', value: 9.5 },
                    { label: 'After 10am', value: 10.5 },
                  ].map(({ label, value }) => (
                    <button
                      key={label}
                      className={`day-check-btn ${wakeHour === value ? 'selected' : ''}`}
                      onClick={() => { localStorage.setItem('wakeHour_' + todayKey, String(value)); setWakeHour(value); }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {wakeHour !== null && (
                  <>
                    <p className="check-in-prompt" style={{ marginTop: '0.85rem' }}>Body scan — how does today feel?</p>
                    <div className="day-check-options">
                      <button className={`day-check-btn ${dayCheck === 'better' ? 'selected' : ''}`} onClick={() => handleDayCheck('better')}>Good / Same</button>
                      <button className={`day-check-btn warn ${dayCheck === 'mildly-worse' ? 'selected' : ''}`} onClick={() => handleDayCheck('mildly-worse')}>Mildly off</button>
                      <button className={`day-check-btn danger ${dayCheck === 'clearly-worse' ? 'selected' : ''}`} onClick={() => handleDayCheck('clearly-worse')}>Rough day</button>
                    </div>
                    {dayCheck === 'mildly-worse' && <p className="decision-note warn">Consider reducing long blocks and adding a movement break earlier in the day.</p>}
                    {dayCheck === 'clearly-worse' && !routineOverridden && (
                      <div className="decision-note danger">
                        <p style={{ margin: '0 0 0.5rem' }}>Switching to Integration Day — lighter blocks, more breaks, no pressure on deep work. Your repeating tasks will reflect this at reset.</p>
                        <button className="ghost small" onClick={() => { setSettingsPatch({ routineType: 'session' }); setRoutineOverridden(true); }}>Keep Session Day instead</button>
                      </div>
                    )}
                    {dayCheck === 'clearly-worse' && routineOverridden && (
                      <p className="decision-note warn">Keeping Session Day. Adjust scope as needed.</p>
                    )}
                  </>
                )}

                {wakeHour !== null && dayCheck && (
                  <>
                    <p className="check-in-prompt" style={{ marginTop: '0.85rem' }}>How is your attention right now?</p>
                    <div className="health-grid">
                      {HEALTH_OPTIONS.map((option) => (
                        <button key={option.key} className={`health-option ${settings.healthState === option.key ? 'selected' : ''}`} onClick={() => setSettingsPatch({ healthState: option.key })}>
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {(() => {
                      const needsReset = settings.preferences?.lastResetDate !== todayKey;
                      const carryover = needsReset
                        ? settings.phases.flatMap((phase) =>
                            (phase.tasks ?? [])
                              .filter((t) => t.type !== 'template' && !t.done)
                              .map((t) => ({ ...t, phaseId: phase.id, phaseName: phase.name }))
                          )
                        : [];
                      return carryover.length > 0 ? (
                        <div className="carryover-section">
                          <p className="check-in-prompt" style={{ marginTop: '0.85rem' }}>
                            {carryover.length} task{carryover.length !== 1 ? 's' : ''} from yesterday
                          </p>
                          {carryover.map((task) => (
                            <div key={task.id} className="carryover-task-row">
                              <div className="carryover-task-info">
                                <span className="carryover-task-title">{task.title}</span>
                                <span className="carryover-task-phase">{task.phaseName}</span>
                                {task.carryCount >= 2 && (
                                  <span className={`carry-badge ${task.carryCount >= 3 ? 'carry-stuck' : ''}`}>
                                    {task.carryCount >= 3 ? `${task.carryCount}d — revisit?` : `${task.carryCount}d`}
                                  </span>
                                )}
                              </div>
                              <button
                                className="ghost small"
                                onClick={() => deleteTask(task.phaseId, task.id)}
                              >
                                Let go
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}

                    <button className="secondary" style={{ marginTop: '0.85rem' }} onClick={handleCompleteCheckin}>
                      Into the day
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Proactive task suggestion */}
            {checkInDone && proactiveTask && (
              <div className="card proactive-card">
                <p className="card-label">Now</p>
                <p className="proactive-prompt">
                  Based on your circadian window{cycleInfo ? `, ${cycleInfo.label.toLowerCase()} phase,` : ''} and attention state:
                </p>
                <p className="proactive-task">{proactiveTask.title}</p>
                {proactiveTask.minutes && (
                  <p className="proactive-meta">{proactiveTask.minutes} min · {activePhase.name}</p>
                )}
              </div>
            )}

            {/* Day plan — all phases */}
            <div className="day-plan">
              {settings.phases.map((phase, phaseIndex) => {
                const startH = settings.phases.slice(0, phaseIndex).reduce((sum, p) => sum + p.defaultMinutes / 60, 0);
                const endH = startH + phase.defaultMinutes / 60;
                const fmtH = (h) => Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
                const isActive = phase.id === settings.activePhaseId;
                const tasks = phase.tasks ?? [];
                const doneTasks = tasks.filter((t) => t.done).length;
                const em = getEnergyMode(phase.name);
                const suggestions = getSuggestions(settings.routineType, phase.name);

                const isCollapsed = collapsedPhases.has(phase.id);

                return (
                  <section key={phase.id} className={`phase-section ${isActive ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
                    {/* Phase header — always clickable to collapse/expand */}
                    <div
                      className="phase-section-header"
                      role="button"
                      tabIndex={0}
                      onClick={() => togglePhaseCollapsed(phase.id)}
                      onKeyDown={(e) => e.key === 'Enter' && togglePhaseCollapsed(phase.id)}
                    >
                      <div className="phase-header-left">
                        {isActive && <span className="active-dot" aria-label="Active phase" />}
                        <div>
                          <h3 className="phase-header-name">{phase.name}</h3>
                          {!isCollapsed && <span className="phase-header-meta">{fmtH(startH)}–{fmtH(endH)} · {em.mode}</span>}
                        </div>
                      </div>
                      <div className="phase-header-right">
                        <span className="phase-task-count">{doneTasks}/{tasks.length}</span>
                        {isActive && !isCollapsed && (
                          phaseRunning ? (
                            <div className="phase-timer-inline">
                              <span className="phase-timer-display">{formatSeconds(phaseRemaining)}</span>
                              <button className="ghost small" onClick={(e) => { e.stopPropagation(); handlePausePhase(); }}>Pause</button>
                              <button className="ghost small" onClick={(e) => { e.stopPropagation(); handleResetPhase(); }}>Reset</button>
                            </div>
                          ) : (
                            <button
                              className="secondary small"
                              onClick={(e) => { e.stopPropagation(); handleStartPhase(); }}
                            >
                              ▶ {activePhase.defaultMinutes}m
                            </button>
                          )
                        )}
                        <span className="phase-chevron">{isCollapsed ? '▸' : '▾'}</span>
                      </div>
                    </div>

                    {/* Collapsible body */}
                    {!isCollapsed && <>

                    {/* Task list */}
                    <div className="task-list">
                      {tasks.map((task) => {
                        const timer = taskTimers[task.id];
                        const timerRunning = timer?.running ?? false;
                        const timerSeconds = timer?.seconds ?? 0;
                        const isEditing = editingTaskId === task.id;

                        const taskFit = getTaskFit(task, activeProfile);
                        return (
                          <article key={task.id} className={`task-row ${task.done ? 'done' : ''} ${isEditing ? 'editing' : ''} ${taskFit > 0 && !task.done ? 'fit-hint' : ''}`}>
                            {isEditing ? (
                              <form className="task-edit-form" onSubmit={(e) => { e.preventDefault(); saveEditTask(phase.id, task.id); }}>
                                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus />
                                <input type="number" placeholder="min (optional)" value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} />
                                <button type="submit">Save</button>
                                <button type="button" className="ghost" onClick={cancelEditTask}>Cancel</button>
                                <button type="button" className="ghost small danger-text" onClick={() => deleteTask(phase.id, task.id)}>Delete</button>
                              </form>
                            ) : (
                              <>
                                <button
                                  className={`task-check ${task.done ? 'checked' : ''}`}
                                  onClick={() => toggleTask(phase.id, task.id)}
                                  aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
                                />
                                <div className="task-copy">
                                  <span className="task-title">{task.title}</span>
                                  <div className="task-meta-row">
                                    {task.type === 'template' && (
                                      <span className="task-repeat-dot" title="Repeating task" />
                                    )}
                                    {task.type !== 'template' && task.carryCount > 0 && (
                                      <span className={`carry-badge${task.carryCount >= 3 ? ' carry-stuck' : ''}`} title={`Carried over ${task.carryCount} day${task.carryCount !== 1 ? 's' : ''}`}>
                                        {task.carryCount >= 3 ? `${task.carryCount}d — revisit?` : `${task.carryCount}d`}
                                      </span>
                                    )}
                                    {task.minutes && !timer && (
                                      <span className="task-duration">{task.minutes} min</span>
                                    )}
                                    {timer && (
                                      <span className="task-timer-running">
                                        {timerRunning ? formatSeconds(timerSeconds) : `${formatSeconds(timerSeconds)} left`}
                                        {' · '}{task.minutes}m total
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="task-actions">
                                  {task.minutes && (
                                    <button
                                      className={`task-timer-btn ${timerRunning ? 'active' : ''}`}
                                      onClick={() => toggleTaskTimer(task.id, task.minutes)}
                                      title={timerRunning ? 'Pause timer' : `Start ${task.minutes}m timer`}
                                    >
                                      {timerRunning ? '⏸' : '▶'}
                                    </button>
                                  )}
                                  {timer && (
                                    <button className="ghost small" onClick={() => resetTaskTimer(task.id)} title="Reset timer">↺</button>
                                  )}
                                  <button className="ghost small" onClick={() => startEditTask(task)}>Edit</button>
                                </div>

                              </>
                            )}
                          </article>
                        );
                      })}
                    </div>

                    {/* Quick add */}
                    <form
                      className="quick-add-form"
                      onSubmit={(e) => { e.preventDefault(); addTaskToPhase(phase.id, quickAddInputs[phase.id] ?? ''); }}
                    >
                      <input
                        className="quick-add-input"
                        type="text"
                        placeholder="+ Add a task…"
                        value={quickAddInputs[phase.id] ?? ''}
                        onChange={(e) => setQuickAddInputs((current) => ({ ...current, [phase.id]: e.target.value }))}
                      />
                    </form>

                    {/* Suggestions (active phase only) */}
                    {isActive && suggestions.length > 0 && (
                      <div className="suggestion-strip">
                        {suggestions.map((s) => (
                          <button key={s.title} className="ghost small" onClick={() => addSuggestionTask(phase.id, s)}>
                            + {s.title}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Next action suggestion */}
                    {isActive && (
                      <>
                        <button className="ghost small suggest-btn" onClick={suggestNextAction}>Suggest next action</button>
                        {mindAction && <p className="status-message">{mindAction}</p>}
                      </>
                    )}

                    </>}{/* end collapsible body */}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
