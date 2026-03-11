## Lifebuddy – Agent Guide

- **Tech stack**
  - Backend: Node.js 20, TypeScript, AWS SAM (`template.yaml`), Lambda (`backend/dist/handler.js`, `backend/dist/reminder.js`), DynamoDB.
  - Frontend: Vite + React + TypeScript in `frontend/`.

- **Where to edit**
  - Only edit source files:
    - Backend: `backend/src/**` (auth, handler, models, reminder, etc.).
    - Frontend: `frontend/src/**`.
  - Do **not** edit generated artifacts:
    - `dist/` folders (compiled output).
    - `.aws-sam/**` (SAM build output).
    - `node_modules/**`.

- **Commands**
  - Lint: `npm run lint` (or `backend:lint`, `frontend:lint`).
  - Tests: `npm run test` (or `backend:test`, `frontend:test`).
  - Build: `npm run build`.
  - Deploy backend: `npm run deploy` (runs backend build, `sam build`, `sam deploy`).

- **Backend conventions**
  - HTTP entrypoint: `backend/src/handler.ts` (routes `/auth/*`, `/habits`, `/habits/{id}`, `/habits/{id}/checkins`).
  - Auth logic: `backend/src/auth.ts` (JWT + bcrypt, `JWT_SECRET` from env).
  - Data model & keys: `backend/src/models.ts` (DynamoDB key shapes).
  - Config: `backend/src/config.ts` (env var access – do not hardcode secrets).

- **Frontend conventions**
  - Main app shell and `/today` experience: `frontend/src/App.tsx`.
  - Entrypoint: `frontend/src/main.ts`.
  - Styles: `frontend/src/style.css` (modern dark UI).

- **General rules**
  - Prefer type-safe changes; keep TypeScript `strict` settings.
  - Avoid weakening lint rules unless the user asks.
  - Do not change `template.yaml` deployment parameters or `samconfig.toml` unless explicitly requested.

