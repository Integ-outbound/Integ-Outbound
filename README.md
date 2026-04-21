# Internal Outbound Operations Backend

This repository contains a single Node.js + TypeScript backend for running an internal B2B outbound operations pipeline. It is a workflow engine with AI assistance at specific nodes, not a chatbot and not a direct email sender.

## Source Of Truth

The only source of truth is the root `src/` application:

```text
src/
  ai/
  api/
  db/
  modules/
  queue/
  index.ts
```

There is no surviving Python, FastAPI, Next.js, SQLite, or OpenAI application in this repo.

## Stack

- Runtime: Node.js with TypeScript
- Framework: Express.js
- Database: PostgreSQL with raw SQL only
- AI: Anthropic SDK only, centralized in `src/ai/client.ts`
- Queue: pg-boss
- Validation: zod
- Environment: dotenv
- Deployment target: Render

## What The System Does

- Stores and manages the company universe.
- Scores companies against an active ICP and generates shortlists.
- Stores, verifies, and suppresses contacts.
- Enriches companies with structured Anthropic-backed research.
- Generates outbound drafts and routes them into review.
- Tracks campaigns, leads, send-ready state, sent state, replies, and outcomes.
- Maintains an audit trail in `system_events`.
- Exposes health and readiness endpoints for operations.

## Implemented Modules

- `universe`
- `icp`
- `contacts`
- `enrichment`
- `drafts`
- `review`
- `sending`
- `replies`
- `memory`
- `observability`
- `campaigns`
- `leads`

## What Is Intentionally Not Implemented Yet

- Direct email delivery. The system tracks queue and send state only.
- Per-user auth and user management. The current auth model is a shared internal API key.
- Automated tests. Validation is currently by typecheck, build, startup, and manual smoke checks.
- A built-in contact discovery provider. Contacts can be ingested and verified, but provider-backed discovery is not part of the current implementation.

## Authentication

All `/api/v1` routes require `x-api-key`, except:

- `GET /api/v1/ready`

Set the shared key with `INTERNAL_API_KEY` and send it in the request header:

```text
x-api-key: your_internal_api_key
```

Security requirements:

- `INTERNAL_API_KEY` must be at least 32 characters long.
- Use a long random secret, not a human-readable password.
- Do not expose this key to browser clients or frontend code.
- Rotate it if it is ever copied into logs, screenshots, or shared notes.

## Environment Variables

Copy `.env.example` to `.env` and fill in real values locally.

```env
DATABASE_URL=postgresql://user:password@127.0.0.1:5432/integ
ANTHROPIC_API_KEY=
PORT=3000
VERIFICATION_PROVIDER=millionverifier
VERIFICATION_API_KEY=
INTERNAL_API_KEY=
START_WORKER=true
NODE_ENV=development
```

Notes:

- Keep live secrets in `.env` only. Do not commit them.
- Use a long random value for `INTERNAL_API_KEY`; the app will refuse to boot with a short key.
- Anthropic model selection is fixed inside `src/ai/client.ts`.
- PostgreSQL is required. There is no SQLite fallback.
- Anthropic-backed flows require a funded Anthropic account. If billing is not active, enrichment, draft generation, and reply classification will fail.
- For a dedicated web process on Render, set `START_WORKER=false`.

## Local Setup

1. Install Node.js 20+ and PostgreSQL.
2. Create a PostgreSQL database named `integ`, or point `DATABASE_URL` at a different database.
3. Copy `.env.example` to `.env`.
4. Set a value for `INTERNAL_API_KEY`.
5. Install dependencies:

```powershell
npm install
```

## Migrations

Schema creation is handled by `src/db/migrations.ts`, which runs the SQL in `src/db/schema.sql`.

- Migrations run automatically on API startup.
- They are idempotent and safe to run repeatedly against the same database.

## How To Start The API

Local development:

```powershell
npm run dev
```

Compiled production-style startup:

```powershell
npm run build
npm start
```

Base path:

- `http://localhost:3000/api/v1`

## How To Start The Worker

Local combined mode:

- `npm run dev` starts the API and the worker together when `START_WORKER=true`.

Dedicated worker mode:

```powershell
npm run worker
```

Web-only mode:

- set `START_WORKER=false`
- start the API with `npm run dev` or `npm start`
- run `npm run worker` separately

## Local Run Sequence

1. Start PostgreSQL.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL`, `ANTHROPIC_API_KEY`, `VERIFICATION_API_KEY`, and `INTERNAL_API_KEY`.
4. Install dependencies with `npm install`.
5. Start the API and worker with `npm run dev`.
6. Check:
   - `GET /api/v1/ready`
   - `GET /api/v1/health` with `x-api-key`

Optional split-process mode:

1. Set `START_WORKER=false` for the API process.
2. Run `npm run build`.
3. Start the API with `npm start`.
4. Start the worker with `npm run worker`.

## Minimal Operator API Surface

Existing operational routes cover companies, ICP, contacts, enrichment, drafts, review, sending, replies, memory, and observability.

Additional operator-facing routes:

- `POST /api/v1/campaigns`
- `GET /api/v1/campaigns`
- `GET /api/v1/campaigns/:id`
- `PATCH /api/v1/campaigns/:id`
- `POST /api/v1/leads`
- `GET /api/v1/leads`
- `GET /api/v1/leads/:id`
- `POST /api/v1/leads/:id/reject`
- `POST /api/v1/leads/:id/suppress`
- `POST /api/v1/leads/:id/reschedule`
- `GET /api/v1/health`
- `GET /api/v1/ready`

## Deployment Model

The repository includes `render.yaml` for a Render deployment with:

- one managed PostgreSQL instance
- one web service for the API
- one worker service for pg-boss jobs

Web service:

- build: `npm install && npm run build`
- start: `npm start`
- env: `START_WORKER=false`

Worker service:

- build: `npm install && npm run build`
- start: `npm run worker`

## Operations And Runbooks

- Operator flow: [docs/operator-runbook.md](docs/operator-runbook.md)
- Production operations: [docs/production-ops.md](docs/production-ops.md)
- Launch checklist: [docs/launch-smoke-checklist.md](docs/launch-smoke-checklist.md)

## Readiness Script

A non-mutating readiness checker is included:

```powershell
npm run readiness:check
```

It validates:

- `/ready`
- `/health`
- auth gate behavior
- route availability for protected non-mutating endpoints

## Validation Commands

```powershell
npm run typecheck
npm run build
npm run readiness:check
```

These validate the application structure and non-mutating runtime behavior. Full AI validation still requires valid external credentials and funded Anthropic billing.

## Security Posture

- `x-powered-by` is disabled.
- Security response headers are applied globally.
- Mutating API requests must use JSON content types.
- Sensitive operational routes are protected behind `x-api-key`.
- Public readiness is limited to `/ready`.
- Request bodies are size-limited.
- Production error responses avoid leaking internal details.
