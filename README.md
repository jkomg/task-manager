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
- If no admin exists yet in local auth mode, a signed-in user can claim admin access from the Profile page.
- Admins get an in-app Admin page for:
  - toggling feature flags
  - viewing recent audit/error events
  - searching users
  - inspecting user state and active sessions
  - suspending/reactivating accounts
  - revoking sessions
  - resetting planner state
  - seeding demo planner data
  - clearing planner activity (while keeping the account)

## Local Data

- SQLite database path: `data/focus-flow.db`
- Session state uses an HTTP-only cookie in the browser.
- User records now track `auth_provider`, `auth_subject`, `account_status`, and `last_login_at` so local password auth can be swapped for managed auth later without rewriting the user model.
- Local runtime artifacts should stay out of git and out of Docker build context.

## Auth Mode

- `AUTH_MODE=local` is the default for local development.
- `AUTH_MODE=managed` disables password sign-in and registration in the UI/API so the app can be wired to a managed identity provider later.
- `MANAGED_AUTH_PROVIDER` is an optional label shown in the UI/admin panel when managed mode is enabled.

## Change Management

- `main` holds the latest stable local baseline.
- Use short-lived branches for work, prefixed with `codex/` for agent-created branches.
- Keep commits focused on one functional change at a time.
- Run `npm run build` before committing UI changes.

## Next Likely Steps

- Add a real backend and database for multi-device persistence.
- Add reusable routine templates and recurring defaults.
- Add a better visual phase flow and timer history.
