## Contributing to Lifebuddy

This project is still early and evolving quickly. These guidelines keep changes consistent and easy to reason about.

### Development setup

- **Backend**
  - Location: `backend/`
  - Install deps: `cd backend && npm install`
  - Build: `npm run build`
  - Lint: `npm run lint`
  - Test: `npm run test`

- **Frontend**
  - Location: `frontend/`
  - Install deps: `cd frontend && npm install`
  - Dev server: `npm run dev`
  - Lint: `npm run lint`
  - Test: `npm run test`

From the repo root you can also run:

- `npm run lint` – backend + frontend lint.
- `npm run test` – backend + frontend tests.
- `npm run build` – backend + frontend builds.
- `npm run deploy` – backend build + `sam build` + `sam deploy`.

### Code style and linting

- TypeScript is **strict** in both backend and frontend.
- ESLint + Prettier are configured:
  - Backend: `backend/eslint.config.cjs`
  - Frontend: `frontend/eslint.config.cjs`
- Before opening a PR or pushing:
  - Run `npm run lint`.
  - Run `npm run test`.

### Testing

- **Backend**: Jest (`backend/jest.config.js`).
  - Focus first on pure functions and helpers (e.g. key helpers, small auth utilities).
- **Frontend**: Vitest + Testing Library.
  - Prefer tests that exercise components via user interactions over shallow implementation details.

### Files and directories to avoid changing

- Do not edit generated or build artifacts:
  - `dist/`, `backend/dist/`, `frontend/dist/`
  - `.aws-sam/**`
  - `node_modules/**`
- Be careful with:
  - `template.yaml` – infrastructure changes should be deliberate and tested.
  - `samconfig.toml` – only adjust if you understand the deployment impact.

### Secrets and environment

- Do **not** commit secrets.
  - The root `.env` file is ignored by git.
  - `frontend/.env` is committed and should only contain non-sensitive defaults (for example, `VITE_API_BASE`). Do not add secrets to this file.
  - For local frontend-only secrets, use a separate untracked env file (for example, `frontend/.env.local`) and ensure it is listed in `.gitignore`.
- Backend secrets (e.g. `JWT_SECRET`) are provided via Lambda environment variables configured in SAM (`JwtSecret` parameter).

