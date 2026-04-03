import { TASK_LIBRARY } from './focusFlowData.js';

export function formatSeconds(totalSeconds) {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function createTask(title, minutes = null, type = 'oneoff', details = '') {
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
    details: typeof details === 'string' ? details.trim() : '',
  };
}

export function moveItem(items, fromIndex, toIndex) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function firstName(displayName) {
  return String(displayName ?? '').trim().split(/\s+/)[0] || 'there';
}

export function getPhaseKey(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('quiet') || n.includes('morning')) return 'morning';
  if (n.includes('activation') || n.includes('bridge')) return 'activation';
  if (n.includes('deep') || n.includes('window') || n.includes('afternoon') || n.includes('midday')) return 'deep';
  if (n.includes('body') || n.includes('recovery')) return 'recovery';
  if (n.includes('drift') || n.includes('wind') || n.includes('evening') || n.includes('night')) return 'evening';
  return 'custom';
}

export function getSuggestions(routineType, phaseName) {
  const key = getPhaseKey(phaseName);
  const type = routineType === 'integration' ? 'integration' : 'session';
  return TASK_LIBRARY[type][key] ?? TASK_LIBRARY[type].custom;
}

export function formatClockFromIso(iso, timeZone) {
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

export function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function getDateKey(timeZone = getBrowserTimeZone()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
    const month = parts.find((part) => part.type === 'month')?.value ?? '01';
    const day = parts.find((part) => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function storageKeyForUser(userId, name) {
  return `focusflow:${userId ?? 'guest'}:${name}`;
}

export function circadianWindow(hour) {
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

export function toF(c) {
  return Math.round(c * 9 / 5 + 32);
}

const PHASE_ENERGY_MODES = {
  'quiet window': { mode: 'Receptive + Absorptive', hint: 'Input, gentle focus, capture' },
  'activation bridge': { mode: 'Transitional', hint: 'Compost, light writing, bridging to depth' },
  'deep window': { mode: 'Generative + Executive', hint: 'Draft, revise, deep cognitive work' },
  'body + recovery': { mode: 'Physical + Lighter', hint: 'Movement, rehab, restorative breaks' },
  'afternoon drift': { mode: 'Flexible + Admin', hint: 'Review, admin, light maintenance' },
  'evening wind-down': { mode: 'Settling', hint: 'Wind-down, light reading, planning tomorrow' },
  morning: { mode: 'Receptive + Absorptive', hint: 'Input, gentle focus, capture' },
  afternoon: { mode: 'Generative + Executive', hint: 'Draft, revise, deep cognitive work' },
  evening: { mode: 'Settling', hint: 'Wind-down, review, light tasks' },
};

export function getEnergyMode(phaseName) {
  const key = String(phaseName ?? '').toLowerCase().trim();
  return (
    PHASE_ENERGY_MODES[key] ??
    PHASE_ENERGY_MODES[getPhaseKey(phaseName)] ??
    { mode: 'Focused', hint: 'Keep scope small and visible.' }
  );
}

export function getRecommendedWritingMode(phaseName, healthState) {
  const n = String(phaseName ?? '').toLowerCase();
  const isQuiet = n.includes('quiet') || n.includes('morning');
  const isActivation = n.includes('activation') || n.includes('bridge');
  const isDeep = n.includes('deep') || n.includes('window') || n.includes('afternoon') || n.includes('midday');
  const isBody = n.includes('body') || n.includes('recovery');
  const isEvening = n.includes('drift') || n.includes('wind') || n.includes('evening') || n.includes('night');

  if (isQuiet) {
    if (healthState === 'drained' || healthState === 'scattered') return 'Capture';
    return 'Study';
  }
  if (isActivation) {
    if (healthState === 'drained' || healthState === 'scattered') return 'Capture';
    return 'Compost';
  }
  if (isDeep) {
    if (healthState === 'drained') return 'Study';
    if (healthState === 'scattered') return 'Compost';
    return 'Draft';
  }
  if (isBody) {
    return 'Capture';
  }
  if (isEvening) {
    if (healthState === 'drained' || healthState === 'scattered') return 'Capture';
    return 'Revise';
  }
  if (healthState === 'drained') return 'Capture';
  if (healthState === 'scattered') return 'Compost';
  return 'Draft';
}

function getCircadianWindowKey(hoursAwake) {
  if (hoursAwake < 1.5) return 'car';
  if (hoursAwake < 4.5) return 'rising';
  if (hoursAwake < 7) return 'peak';
  if (hoursAwake < 9) return 'trough';
  if (hoursAwake < 12) return 'secondWind';
  if (hoursAwake < 15) return 'windDown';
  return 'melatonin';
}

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

export function getActiveProfile(hoursAwake, healthState, cycleInfo) {
  if (hoursAwake === null || hoursAwake === undefined) return null;
  const win = getCircadianWindowKey(hoursAwake);
  const cycleLow = cycleInfo?.phase === 'menstrual' || cycleInfo?.phase === 'luteal-late';
  const cycleHigh = cycleInfo?.phase === 'follicular' || cycleInfo?.phase === 'ovulatory';

  if (win === 'melatonin') return ADHD_PROFILES.restSignal;
  if (win === 'windDown') return ADHD_PROFILES.settleIn;
  if (healthState === 'drained') return cycleLow ? ADHD_PROFILES.heavyDay : ADHD_PROFILES.lowBattery;
  if (healthState === 'scattered') return ADHD_PROFILES.microSprint;
  if (win === 'trough') return ADHD_PROFILES.recoveryTrough;
  if (win === 'car') return cycleLow ? ADHD_PROFILES.gentleStart : ADHD_PROFILES.softStart;
  if (win === 'rising') return cycleHigh ? ADHD_PROFILES.strongInput : cycleLow ? ADHD_PROFILES.lightInput : ADHD_PROFILES.risingCapacity;
  if (win === 'peak') return cycleHigh ? ADHD_PROFILES.highCapacity : cycleLow ? ADHD_PROFILES.constrainedPeak : ADHD_PROFILES.creativeWindow;
  if (win === 'secondWind') return cycleHigh ? ADHD_PROFILES.secondWindStrong : ADHD_PROFILES.secondWind;
  return ADHD_PROFILES.creativeWindow;
}

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

export function getTaskFit(task, profile) {
  if (!profile?.taskTypes?.length || task.done) return 0;
  const types = inferTaskTypes(task);
  let score = 0;
  for (const type of types) {
    if (profile.taskTypes.includes(type)) score++;
  }
  return score;
}

export function getDynamicLightRec(hour, weather, healthState, cycleInfo) {
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

export function getCyclePhase(cycleStartDate, cycleLength = 28) {
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

export function getCycleTip(cycleInfo) {
  if (!cycleInfo) return null;
  const tips = {
    menstrual: 'Energy may be lower today — lighter tasks and rest are valid choices.',
    follicular: 'Energy is rising — a good window for new ideas and learning.',
    ovulatory: 'Communication and output tend to peak here. Good time for generative work.',
    'luteal-early': 'Analytical focus is strong. Good for revision, detail work, and organization.',
    'luteal-late': 'Energy may be shifting. Reduce friction where you can.',
  };
  return tips[cycleInfo.phase] ?? null;
}

export function getProactiveTask(contextHour, healthState, cycleInfo, goals, phases, activePhaseId) {
  const activePhase = phases?.find((phase) => phase.id === activePhaseId);
  if (!activePhase) return null;

  const incompleteTasks = (activePhase.tasks ?? []).filter((task) => !task.done);
  if (incompleteTasks.length === 0) return null;

  const scored = incompleteTasks.map((task) => {
    let score = 0;
    const title = task.title.toLowerCase();

    if (healthState === 'drained') {
      if (task.minutes && task.minutes <= 10) score += 3;
      else if (task.minutes && task.minutes <= 20) score += 1;
    } else if (healthState === 'scattered') {
      if (task.minutes) score += 2;
    } else if (task.minutes && task.minutes >= 25) {
      score += 1;
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

export function greetingFor(period, name) {
  const byPeriod = {
    morning: `Good morning, ${name}`,
    afternoon: `Good afternoon, ${name}`,
    evening: `Good evening, ${name}`,
  };
  return byPeriod[period] ?? `Hi, ${name}`;
}

export function formatDateLong() {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
}
