# Focus Flow

Focus Flow is a local-first ADHD-friendly day planner built around phases, low-friction task flow, and supportive context prompts.

## What It Does

### User features

- Phase-based planner with default morning/afternoon/evening flow.
- Custom phase structure: rename phases, adjust default duration, insert phases anywhere, and add phases at the end.
- Daily check-in with wake-time, body-state, and attention-state prompts.
- Mind context card with weather, UV, sunrise/sunset, and circadian framing.
- Ordered task lists inside each phase.
- Task actions: check/uncheck, edit details, delete, move between phases.
- Repeating template tasks and one-off tasks.
- Nested timers (phase timer + optional per-task timers).
- Exercise section for adding and moving exercise tasks between phases.
- Profile controls for goals, timezone/location refresh, and optional cycle tracking.

### Admin features

- Feature flag controls:
  - `daily_check_in`
  - `mind_context`
  - `cycle_tracking`
  - `task_timers`
  - `proactive_suggestions`
- User search and account inspection (sessions, planner summary, auth lock state).
- User lifecycle controls:
  - create users (local auth mode)
  - reset user passwords (local auth mode)
  - delete users
  - suspend/reactivate accounts
  - revoke sessions
  - unlock login lock state
- Testing controls:
  - reset planner state
  - seed demo planner state
  - clear planner activity
- Recent audit event log for operational visibility.

## Architecture

- Frontend: React + Vite (`src/`)
- API: Express (`server/createApp.js`, `server/server.js`)
- Storage: SQLite via `better-sqlite3` (`data/focus-flow.db`)
- Auth: local password mode by default, with a managed-auth switch (`server/auth.js`)

## Run Locally

### Prerequisites

- Node 20+
- Docker Desktop (if using Docker workflow)

### Docker (recommended for local testing)

```bash
docker compose up --build
```

- App UI: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:3001](http://localhost:3001)
- LAN test URL: `http://<your-local-ip>:3000`

### Without Docker

```bash
npm install
npm run dev
```

## First-Time User Flow

1. Register with name/email/password.
2. Complete onboarding:
   - choose goals
   - optionally configure cycle tracking
   - set phase durations
3. Start from Planner and complete check-in.
4. Start the active phase and work tasks with optional nested timers.
5. Use the top-right profile menu for Profile, Settings, Admin (if admin), and Dashboard navigation.

## Admin Setup And Usage

### How admin role is assigned

- `ADMIN_EMAILS` env var can auto-elevate matching emails.
- Example: `ADMIN_EMAILS=you@example.com,teammate@example.com`
- In local auth mode, if no admin exists yet, a signed-in user can claim admin from Profile.

### Admin safeguards

- You cannot delete your own account.
- You cannot delete the last remaining admin account.
- Password reset and admin-created local users are disabled when `AUTH_MODE=managed`.

## Environment Variables

- `AUTH_MODE`
  - `local` (default): email/password registration and sign-in enabled.
  - `managed`: disables local password registration/login/reset flows.
- `MANAGED_AUTH_PROVIDER`
  - optional label shown in UI/admin when managed mode is active.
- `ADMIN_EMAILS`
  - comma-separated list of emails to auto-grant admin.
- `COOKIE_SECURE`
  - `true` to mark auth cookie as secure (recommended for HTTPS deployments).
- `LOGIN_FAILURE_LIMIT`
  - number of failed password attempts before lock (default `5`).
- `LOGIN_LOCK_MS`
  - lock window duration in milliseconds (default `900000`, 15 minutes).

## Data And Persistence

- DB file: `data/focus-flow.db`
- Sessions use HTTP-only cookies.
- User settings, phase/task state, and admin audit events are persisted in SQLite.

## Development Commands

```bash
npm run dev
npm run build
npm test
```

## Troubleshooting

### Login or API calls fail after container restart

If you see proxy errors from `:3000` to `:3001`, or logs like `better_sqlite3.node: Exec format error`, reset the Docker runtime volumes and rebuild:

```bash
docker compose down --volumes
docker compose up --build
```

### Account lock after repeated bad password attempts

- Wait for the lock window to expire, or
- Use Admin -> Users -> `Unlock login` on that account.

### No admin account available

- In local auth mode, sign in and use Profile -> `Claim admin access` if bootstrap is available.
- Or set `ADMIN_EMAILS` and sign in with a matching account.

## Change Management

- `main` is the stable baseline branch.
- Use short-lived feature branches (agent branches are prefixed with `codex/`).
- Prefer PR-based changes.
