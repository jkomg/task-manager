# Focus Flow

Small local prototype for an ADHD-friendly task app.

## Current Scope

- Break the day into phases such as morning, afternoon, and evening.
- Customize phase names and default lengths.
- Start a phase with a quick mind check and lightweight guidance.
- Work through an ordered checklist for the active phase.
- Start nested task timers inside a running phase.
- Persist the current state in the browser for local testing.

## Local Run

### Docker

```bash
docker compose up --build
```

App URL: [http://localhost:3000](http://localhost:3000)

### Without Docker

```bash
npm install
npm run dev
```

## Change Management

- `main` holds the latest stable local baseline.
- Use short-lived branches for work, prefixed with `codex/` for agent-created branches.
- Keep commits focused on one functional change at a time.
- Run `npm run build` before committing UI changes.

## Next Likely Steps

- Add a real backend and database for multi-device persistence.
- Add reusable routine templates and recurring defaults.
- Add a better visual phase flow and timer history.
