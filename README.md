## Lifebuddy

That magic app that makes life easier – a proactive habit and task assistant.

### What this is

Lifebuddy is a small web + serverless backend that helps you:

- Track **daily habits** (e.g. creatine, pushups, walks).
- See a focused **"Today" view** with a clear **Next up** queue.
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

### API and Postman

The API is described by an **OpenAPI (Swagger) spec** at [`openapi.yaml`](openapi.yaml). You can use it to call the API from **Postman** (or any OpenAPI client).

1. **Import the spec**
   - In Postman: **Import** → choose `openapi.yaml` from the repo (or drag and drop).
   - Postman creates a collection with all endpoints.

2. **Set the base URL**
   - After import, set the collection (or environment) **Base URL** to your deployed API, e.g.  
     `https://<your-api-id>.execute-api.<region>.amazonaws.com`  
     If you use a stage (e.g. `dev`), include it:  
     `https://<your-api-id>.execute-api.<region>.amazonaws.com/dev`
   - You can copy the URL from the `sam deploy` output or from the frontend `.env` (`VITE_API_BASE` without a trailing path).

3. **Get a JWT**
   - **POST** `/auth/login` with body `{"email":"you@example.com","password":"your-password"}` (or use **POST** `/auth/signup` first).
   - Copy the `token` from the response.

4. **Use the token on other requests**
   - In the collection (or folder), set **Authorization** → Type: **Bearer Token** → paste the token.
   - Or add a header: `Authorization: Bearer <token>`.

5. **Example: create a household and add members**
   - **POST** `/households` with body `{"name":"My House"}` → response includes `householdId`.
   - **POST** `/households/{householdId}/members` with body `{"email":"member@example.com"}` to add a member (they must already have an account).

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

### CI (GitHub Actions)

Workflow file: [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

On every **push** and **pull_request** to `main`:

1. **Lint** – backend and frontend ESLint.
2. **Test** – backend Jest, frontend Vitest.
3. **Build** – backend `tsc`, frontend Vite build.

No deploy in CI by default; add a separate workflow or manual step when you want to deploy from GitHub.

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
