# Changelog

## v1.0.0 — 2026-04-02

First stable release of **Focus Flow** — an ADHD-friendly, circadian-aware day planner built for personal use.

### Core features shipped

**Day structure**
- Phase-based day planner with 5 default phases (Quiet Window, Activation Bridge, Deep Window, Body + Recovery, Afternoon Drift)
- Collapsible phases with per-phase timers and task completion tracking
- Phase timeline strip showing cumulative hours at a glance
- Two routine types: Session Day (full productive rhythm) and Integration Day (lighter, recovery-focused)

**Task system**
- Template tasks (repeating daily) vs one-off tasks (today only)
- Daily reset triggered at check-in: template tasks uncheck, done one-offs drop, undone one-offs carry forward
- Carry count badge on tasks passed over multiple days; tasks stuck 3+ days flagged for review
- Per-task timers with pause/resume
- Quick-add and edit/delete in the planner
- Settings: manage repeating tasks per phase (add/remove)

**Morning check-in**
- Wake time selection feeds circadian window calculations
- Body scan with three states: Good/Same, Mildly off, Rough day
- Rough day auto-switches to Integration Day with explanation and override option
- Carryover review: shows undone one-off tasks from yesterday with "Let go" option before starting the day
- Attention state (Steady / Scattered / Drained) sets health coaching for the session

**Circadian + context engine**
- 14 named circadian profiles (Soft Start, High Capacity, Low Battery, Second Wind, etc.) backed by peer-reviewed ADHD research
- Wake-time-relative circadian window calculation (not fixed clock times) to account for ADHD's ~90-minute phase delay
- Real-time weather via Open-Meteo: temperature, UV, sunrise/sunset, light recommendations
- Writing mode guidance (Capture, Compost, Draft, Revise, Study) matched to circadian window and health state
- Proactive task suggestion based on circadian window, health state, and cycle phase

**Cycle tracking (optional)**
- Menstrual cycle phase integration for dopamine/attention context
- Cycle-aware recommendations surfaced throughout the planner and mind check

**Accounts + persistence**
- Email/password accounts with bcrypt hashing
- HTTP-only session cookies (30-day)
- All settings and task state persisted per-user in SQLite
- Auto-save with 500ms debounce

**Onboarding**
- Goal selection (writing, language learning, deep focus, health, admin, study, creative)
- Optional cycle tracking setup
- Phase duration customization

**Infrastructure**
- Docker + docker-compose with host-agnostic port binding (works on any LAN IP)
- Vite dev server with API proxy
- SQLite WAL mode for reliable concurrent access

### Research sources

Circadian profiles and ADHD recommendations are sourced from:
- Kooij et al. (2025) — ADHD as a circadian rhythm disorder (PMC12728042)
- Petrovic et al. (2024) — ADHD and the menstrual cycle (PMC10872410)
- Blatter & Cajochen (2023) — Time of day and chronotype in cognitive function (PMC10683050)
- Robison et al. (2018) — Estrogen and dopamine in ADHD (PMC6207535)
- Mehren et al. (2020) — Physical exercise in ADHD (PMC6945516)
- Cepeda et al. (2000) — Task switching and ADHD (PMID 10885680)
