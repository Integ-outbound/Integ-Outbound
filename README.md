# Internal Outbound Operations System

This repository contains a single Node.js + TypeScript backend for running internal B2B outbound workflows. It is a pipeline with AI assistance at specific nodes, not a chatbot, not an autonomous closer, and not a multi-stack monorepo.

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

## What The System Does

- Manages a persistent company universe.
- Scores companies against an active ICP and generates shortlists.
- Stores and verifies contacts.
- Enriches target companies with AI-generated structured research.
- Generates cold outbound drafts with Anthropic Haiku.
- Supports human review, approval, rejection, and editing.
- Tracks send-ready, sent, bounced, replied, and suppressed lead state.
- Classifies inbound replies and routes them for auto-handling or human review.
- Logs outcomes and operator feedback.
- Maintains an audit trail and health metrics through `system_events`.

## What Is Implemented Now

- `universe`: company upsert, import, filtering, suppression
- `icp`: active ICP management, deterministic scoring, shortlist generation, background rescoring
- `contacts`: contact upsert, company contact listing, opt-out, bounce handling, verification, batch verification
- `enrichment`: Haiku-based enrichment, batch enrichment, enrichment summaries
- `drafts`: Haiku-based draft generation, batch generation, approval, rejection, edit flows
- `review`: review queue, review stats, bulk rejection
- `sending`: send-ready queue, mark-sent, mark-bounced, next-step scheduling, daily stats
- `replies`: ingest, classify, route, unhandled queue, mark-handled
- `memory`: outcome logging and reporting
- `observability`: health checks, audit trail, event logging
- `queue`: pg-boss worker and the required background job handlers

## What Is Intentionally Not Implemented Yet

- Direct email delivery. The system tracks queue and send state only.
- Authentication and user management. `triggered_by` uses `operator` or `system`.
- Automated tests. Validation is currently by typecheck, build, and live startup checks.
- A built-in outbound contact discovery provider. Contacts can be ingested and then verified, but discovery-provider integration is not part of the current implementation.

## Environment Variables

Copy `.env.example` to `.env` and fill in real values locally.

```env
DATABASE_URL=postgresql://user:password@localhost:5432/integ
ANTHROPIC_API_KEY=
PORT=3000
VERIFICATION_PROVIDER=millionverifier
VERIFICATION_API_KEY=
NODE_ENV=development
```

Notes:

- Keep live secrets in `.env` only. Do not commit them.
- Anthropic model selection is fixed inside `src/ai/client.ts`.
- PostgreSQL is required. There is no SQLite fallback.

## Local Setup

1. Install Node.js 20+ and PostgreSQL.
2. Create a PostgreSQL database named `integ` or update `DATABASE_URL` to point at your database.
3. Copy `.env.example` to `.env`.
4. Install dependencies:

```powershell
npm install
```

## Migrations

Schema creation is handled by `src/db/migrations.ts`, which runs the SQL in `src/db/schema.sql`.

- Migrations run automatically on API startup.
- They are idempotent and safe to run repeatedly against the same database.

## How To Start The API

For local development, this is the normal entrypoint:

```powershell
npm run dev
```

For compiled production-style startup:

```powershell
npm run build
npm start
```

API base path:

- `http://localhost:3000/api/v1`

## How To Start The Worker

The API entrypoint starts the pg-boss worker automatically.

If you want to run the queue worker as a dedicated process, use:

```powershell
npm run worker
```

Both modes use the same `src/queue/worker.ts` implementation.

## Local Run Sequence

1. Start PostgreSQL.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `ANTHROPIC_API_KEY`, and `VERIFICATION_API_KEY`.
3. Install dependencies with `npm install`.
4. Start the combined local process with `npm run dev`.
5. Hit `GET /api/v1/health` to confirm database and queue boot completed.

Optional split-process mode:

1. Run `npm run build`.
2. Start the API with `npm start`.
3. Start the worker separately with `npm run worker`.

## Module Overview

- `src/db`
  PostgreSQL pool, transaction helper, schema SQL, and startup migrations.
- `src/ai`
  Anthropic client wrapper, JSON parsing helpers, and centralized prompts.
- `src/modules/universe`
  Company universe lifecycle and suppression.
- `src/modules/icp`
  ICP definition versioning, scoring, and shortlist selection.
- `src/modules/contacts`
  Contact ingestion, verification, opt-out, and bounce state.
- `src/modules/enrichment`
  Company-level structured enrichment using Anthropic Haiku.
- `src/modules/drafts`
  Draft generation, review-state transitions, and send-ready gating.
- `src/modules/review`
  Pending review queue and review analytics.
- `src/modules/sending`
  Send-ready queue state, mark-sent, mark-bounced, and sequence progression.
- `src/modules/replies`
  Reply ingestion, classification, routing, and human review queue.
- `src/modules/memory`
  Outcomes, rejection analytics, and campaign performance reporting.
- `src/modules/observability`
  `system_events`, health reporting, and audit trail queries.
- `src/queue`
  pg-boss job definitions and worker registration.
- `src/api`
  Express router, route handlers, zod validation, and shared HTTP helpers.

## Operational Constraints Enforced In Code

- All AI calls go through `src/ai/client.ts`.
- Anthropic Haiku model selection is centralized in one file.
- All SQL is parameterized raw SQL.
- Database writes are audit-backed through `system_events`.
- Suppression, opt-out, and bounce checks block transitions into `send_ready`.
- IDs are generated with `crypto.randomUUID()`.
- Timestamps are stored in PostgreSQL and returned as ISO 8601 strings.

## Validation Commands

```powershell
npm run typecheck
npm run build
```

These validate the TypeScript application structure. Live runtime validation still requires a real PostgreSQL instance and valid external API credentials.
