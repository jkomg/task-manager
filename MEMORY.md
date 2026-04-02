# Focus Flow Memory

## Purpose

Focus Flow is a local-first ADHD-friendly planning app. The product goal is not generic task management; it is helping a user move through a day with less friction by combining:

- named phases across the day
- ordered, low-friction task lists inside each phase
- nested task timers inside phase timers
- a daily check-in that adapts tone and task pressure
- lightweight weather/circadian context

The current tone should stay calm, practical, and non-shaming. Guidance should feel grounded and human, not clinical or robotic.

## Current Product Shape

- Local web app for testing on a developer machine and local network.
- User accounts exist and settings persist per user in SQLite.
- Core planner model:
  - `phases[]`
  - each phase has `tasks[]`
  - task `type` is `template` or `oneoff`
  - unfinished one-off tasks can carry over day to day
  - day mode can shift between `session` and `integration`
- Check-in flow captures wake time, rough day quality, and attention state.
- Mind/context layer blends:
  - time of day
  - local weather and UV
  - sunrise/sunset
  - optional cycle tracking
  - ADHD-oriented circadian framing

## Theme And UX Intent

- Visual direction: calm, airy, blue/teal, readable, mobile-first.
- Product should feel supportive and focused, not busy or gamified.
- The app is meant to reduce activation energy. Default interactions should stay obvious and forgiving.
- Avoid cluttering the nav with too much persistent metadata. The planner itself should carry the operational detail.

## Architecture

- Frontend: React + Vite in [src/App.jsx](/Users/jasonkennedy/Projects/task-manager/src/App.jsx)
- Styling: single stylesheet in [src/styles.css](/Users/jasonkennedy/Projects/task-manager/src/styles.css)
- Backend: Express API in [server/server.js](/Users/jasonkennedy/Projects/task-manager/server/server.js)
- Persistence: SQLite via `better-sqlite3` in [server/db.js](/Users/jasonkennedy/Projects/task-manager/server/db.js)
- Default user state normalization lives in [server/defaultState.js](/Users/jasonkennedy/Projects/task-manager/server/defaultState.js)

## Runtime Model

- Dev client runs on port `3000`
- API runs on port `3001`
- Docker compose currently runs the development stack, not a production-built image
- SQLite database path is `data/focus-flow.db`

## Release Context

- Repo: `jkomg/task-manager`
- Public GitHub repo
- PR-based workflow is expected for changes
- Current branch at handoff time: `codex/audit-hardening-focusflow`
- Recent release lineage includes tag `v1.0.0`

## Engineering Notes

- Normalize persisted state on every read/write boundary
- Be careful with anything day-based: use the user's local timezone, not UTC midnight
- Local browser-only state should be scoped per user where it affects behavior
- SQLite/runtime artifacts should never be committed
- Security posture is still lightweight because this is a local-first prototype, but obvious gaps should still be closed

## Known Next Areas

- move Docker from dev-mode runtime to a more production-like container path
- add tests around auth/session expiry and daily reset logic
- reduce the size and complexity of `src/App.jsx` by extracting focused components/hooks
- decide how much of the circadian/cycle guidance should remain in-app versus linked or collapsible
