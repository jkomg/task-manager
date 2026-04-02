# Focus Flow

Small local prototype for an ADHD-friendly task app.

## Current Scope

- Break the day into phases such as morning, afternoon, and evening.
- Customize phase names and default lengths.
- Start a phase with a quick mind check and lightweight guidance.
- Work through an ordered checklist for the active phase.
- Start nested task timers inside a running phase.
- Create local user accounts with email and password.
- Persist each user's settings and routines in a local SQLite database.

## Local Run

### Docker

```bash
docker compose up --build
```

App URL: [http://localhost:3000](http://localhost:3000)

LAN test URL: `http://<your-local-ip>:3000`

API URL: `http://localhost:3001`

### Without Docker

```bash
npm install
npm run dev
```

## Admin Access

- Local admin access is controlled by the `ADMIN_EMAILS` environment variable.
- Example: `ADMIN_EMAILS=you@example.com,teammate@example.com`
- Matching users are elevated to the `admin` role on register/login/session refresh.
- Admins get an in-app Admin page for:
  - toggling feature flags
  - viewing recent audit/error events
  - searching users
  - resetting a test user's saved state and sessions

## Local Data

- SQLite database path: `data/focus-flow.db`
- Session state uses an HTTP-only cookie in the browser.
- Local runtime artifacts should stay out of git and out of Docker build context.

## Change Management

- `main` holds the latest stable local baseline.
- Use short-lived branches for work, prefixed with `codex/` for agent-created branches.
- Keep commits focused on one functional change at a time.
- Run `npm run build` before committing UI changes.

## Next Likely Steps

- Add a real backend and database for multi-device persistence.
- Add reusable routine templates and recurring defaults.
- Add a better visual phase flow and timer history.
