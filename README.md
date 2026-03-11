## Lifebuddy

That magic app that makes life easier – a proactive habit and task assistant.

### What this is

Lifebuddy is a small web + serverless backend that helps you:

- Track **daily habits** (e.g. creatine, pushups, walks).
- See a focused **\"Today\" view** with a clear **Next up** queue.
- Record quick **check‑ins** (Done / Snoozed / Skipped).
- Grow over time into a system that also handles chores and long‑running projects.

### Architecture overview

- **Frontend**
  - Vite + React + TypeScript in `frontend/`.
  - Single‑page app with:
    - Auth screen (email/password, signup + login).
    - `/today` experience showing:
      - **Next up** (1–3 pending habits).
      - Habits grouped by time of day (morning/afternoon/evening/any).
      - Actions: Done / Snooze / Skip.

- **Backend**
  - Node.js 20 + TypeScript in `backend/`.
  - Deployed via **AWS SAM** (`template.yaml`) as:
    - `LifebuddyBackendFunction` – HTTP Lambda behind an **HttpApi (API Gateway)**.
    - `ReminderFunction` – scheduled Lambda triggered by EventBridge (MVP: logs habits).
  - **DynamoDB** tables:
    - `UsersTable` – users keyed by `pk = USER#<email>`, `sk = PROFILE`.
    - `HabitsTable` – habits per user keyed by `pk = USER#<userId>`, `sk = HABIT#<habitId>`.
    - `HabitCheckinsTable` – check‑ins per habit keyed by `pk = HABIT#<habitId>`, `sk = DATE#<YYYY-MM-DD>`.

### Local development

#### Prerequisites

- Node.js 20+
- npm
- AWS SAM CLI (for backend build/deploy)
- AWS account + credentials configured for SAM

#### Frontend

From the repo root:

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173`.

Config:

- `frontend/.env`:

```bash
VITE_API_BASE=https://<your-api-id>.execute-api.<region>.amazonaws.com/<stage>
```

#### Backend

From the repo root:

```bash
cd backend
npm install
npm run build

cd ..
sam build
sam deploy
```

On first deploy, SAM will ask for parameters such as:

- **StageName** (e.g. `dev`).
- **JwtSecret** – a strong secret used to sign JWTs (generate via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

Environment variables are wired via `template.yaml` and `backend/src/config.ts`:

- `JWT_SECRET`
- `TABLE_USERS`
- `TABLE_HABITS`
- `TABLE_HABIT_CHECKINS`

### NPM scripts

From the repo root:

- **Lint**: `npm run lint`
- **Tests**: `npm run test`
- **Build**: `npm run build`
- **Deploy backend**: `npm run deploy`

Or individually:

- Backend:
  - `npm run backend:lint`
  - `npm run backend:test`
  - `npm run backend:build`
- Frontend:
  - `npm run frontend:lint`
  - `npm run frontend:test`
  - `npm run frontend:build`

### Key files

- **Backend**
  - `backend/src/handler.ts` – main Lambda handler and HTTP router.
  - `backend/src/auth.ts` – signup/login, JWT token creation and verification.
  - `backend/src/habits.ts` – habit CRUD and check‑in handlers.
  - `backend/src/models.ts` – core types and DynamoDB key helpers.
  - `backend/src/reminder.ts` – scheduled reminder function (MVP logging).
  - `backend/eslint.config.cjs` – lint rules (flat config).

- **Frontend**
  - `frontend/src/App.tsx` – main UI (auth + today view + Next up).
  - `frontend/src/main.ts` – React entrypoint.
  - `frontend/src/style.css` – styling for auth and today views.
  - `frontend/eslint.config.cjs` – frontend lint rules.

### Agents and automation

- `AGENTS.md` documents how AI agents should work in this repo:
  - Only edit `backend/src/**` and `frontend/src/**` for code changes.
  - Never edit `dist/`, `.aws-sam/`, or `node_modules/`.
  - Use `npm run lint`, `npm run test`, and `npm run deploy` as main entrypoints.
