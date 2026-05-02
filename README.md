# Internal Outbound Operations Backend

This repository contains a single Node.js + TypeScript backend for running an internal B2B outbound operations pipeline. It is a workflow engine with AI assistance at specific nodes, not a chatbot. It can send through connected Gmail mailboxes, but only through internal operator/worker-governed flows and not as a public bulk-email platform.

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
- `imports`
- `mailboxes`

## What Is Intentionally Not Implemented Yet

- Public or generic bulk-email sending. Gmail sending is implemented for connected internal mailboxes, but it remains an operator/worker-governed outbound system rather than a general email platform.
- Per-user auth and user management. The current auth model is a shared internal API key.
- A built-in contact discovery provider. Contacts can be ingested and verified, but provider-backed discovery is not part of the current implementation.

## Authentication

All `/api/v1` routes require `x-api-key`, except:

- `GET /api/v1/ready`
- `GET /api/v1/mailboxes/google/oauth/callback`

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
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/mailboxes/google/oauth/callback
GOOGLE_GMAIL_SCOPES=https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/gmail.modify
MAILBOX_TOKEN_ENCRYPTION_KEY=
START_WORKER=true
NODE_ENV=development
```

Notes:

- Keep live secrets in `.env` only. Do not commit them.
- Use a long random value for `INTERNAL_API_KEY`; the app will refuse to boot with a short key.
- Anthropic model selection is fixed inside `src/ai/client.ts`.
- PostgreSQL is required. There is no SQLite fallback.
- Anthropic-backed flows require a funded Anthropic account. If billing is not active, enrichment, draft generation, and reply classification will fail.
- Gmail OAuth requires a Google Cloud OAuth web client whose redirect URI matches `GOOGLE_REDIRECT_URI`.
- `MAILBOX_TOKEN_ENCRYPTION_KEY` is required for mailbox refresh-token encryption and must be separate from `INTERNAL_API_KEY`.
- Rotating `MAILBOX_TOKEN_ENCRYPTION_KEY` requires either mailbox reconnects or a controlled token re-encryption migration.
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

- `GET /api/v1/mailboxes`
- `GET /api/v1/mailboxes/:id`
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
- `GET /api/v1/contacts`
- `GET /api/v1/import-batches/:id`
- `GET /api/v1/mailboxes/google/oauth/start`
- `GET /api/v1/mailboxes/google/oauth/callback`
- `POST /api/v1/mailboxes/:id/test-send`
- `POST /api/v1/mailboxes/:id/sync`
- `POST /api/v1/sending/process-send-ready`
- `GET /api/v1/health`
- `GET /api/v1/ready`

Client-scoped mutation routes require an explicit JSON `client_id`. The shared internal API key is not sufficient to mutate mailbox, campaign, lead, draft, reply, review, or send-state records by raw UUID alone. Internal background jobs use the service layer directly rather than bypassing that requirement through public HTTP endpoints.

## Gmail OAuth Setup

This backend supports Gmail OAuth mailbox connection, Gmail API test send, manual Gmail inbox polling sync, scheduled Gmail polling sync, and autonomous processing of `send_ready` leads through Gmail. Push notifications and inbox auto-replies are intentionally not implemented yet.

Required Gmail scopes:

- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.modify`

OAuth start behavior:

- requests `access_type=offline`
- requests `prompt=consent`
- returns a Google authorization URL in JSON

OAuth callback behavior:

- validates signed state
- exchanges the authorization code
- fetches the Gmail profile
- creates or updates the mailbox record
- stores the refresh token encrypted in PostgreSQL

Manual sync behavior:

- `POST /api/v1/mailboxes/:id/sync`
- polls recent Gmail messages through the Gmail API
- stores canonical Gmail threads and messages in PostgreSQL
- detects inbound replies and routes matched replies into the existing `replies` classification pipeline
- suppresses future sequence steps for the matched outbound lead once a real reply is ingested
- sync requires an active mailbox and allows `unhealthy` status for recovery, but not `disabled`

Mailbox status behavior:

- `GET /api/v1/mailboxes`
- `GET /api/v1/mailboxes/:id`
- returns mailbox status, sync health, last sync time, daily send count, and daily send limit

Autonomous worker behavior:

- pg-boss schedules `gmail.syncMailbox` every 5 minutes
- pg-boss schedules `gmail.sendReadyLead` every 2 minutes
- sync only runs for active connected mailboxes
- send-ready processing only sends from active connected mailboxes under their daily cap
- direct `POST /api/v1/mailboxes/:id/test-send` uses the same active and connected send gate and does not bypass mailbox quarantine
- Gmail send failures are recorded in `mailbox_send_attempts`
- repeated auth failures mark the mailbox unhealthy
- suppression or contact-state blocks suppress the lead instead of repeatedly retrying it
- repeated hard send failures pause the lead back into human review instead of retrying forever

### Curl Smoke Flow

1. Start OAuth:

```bash
curl -s \
  -H "x-api-key: YOUR_INTERNAL_API_KEY" \
  http://localhost:3000/api/v1/mailboxes/google/oauth/start
```

Copy the returned `authorizationUrl` into a browser, sign in, and approve Gmail access.

2. Complete callback manually in the browser:

- Google redirects to `http://localhost:3000/api/v1/mailboxes/google/oauth/callback`
- The browser response includes the connected mailbox record
- Copy the returned `mailbox.id`

3. Send a test email:

```bash
curl -s \
  -X POST \
  -H "x-api-key: YOUR_INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"YOUR_CLIENT_ID","to":"you@example.com","subject":"Gmail OAuth test","body":"This is a Gmail API test email from Integ."}' \
  http://localhost:3000/api/v1/mailboxes/MAILBOX_ID/test-send
```

The response includes the Gmail `messageId` and `threadId`.

4. Sync Gmail manually:

```bash
curl -s \
  -X POST \
  -H "x-api-key: YOUR_INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"YOUR_CLIENT_ID","maxResults":50}' \
  http://localhost:3000/api/v1/mailboxes/MAILBOX_ID/sync
```

The response includes sync counts and reply-ingestion counts.

5. List connected mailboxes:

```bash
curl -s \
  -H "x-api-key: YOUR_INTERNAL_API_KEY" \
  http://localhost:3000/api/v1/mailboxes
```

6. Trigger send-ready processing manually:

```bash
curl -s \
  -X POST \
  -H "x-api-key: YOUR_INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"YOUR_CLIENT_ID","limit":10}' \
  http://localhost:3000/api/v1/sending/process-send-ready
```

The response shows how many leads were sent, blocked, or failed.

### Smoke Script

You can also use the bundled smoke script:

```powershell
$env:API_KEY="YOUR_INTERNAL_API_KEY"
npm run mailboxes:smoke
```

That prints the OAuth start URL. After you complete consent in the browser and get back a `mailbox.id`, rerun:

```powershell
$env:API_KEY="YOUR_INTERNAL_API_KEY"
$env:MAILBOX_ID="MAILBOX_UUID"
$env:TEST_EMAIL_TO="you@example.com"
npm run mailboxes:smoke
```

## Gmail Reply Sync Smoke Flow

To prove Gmail replies connect back to outbound state:

1. Make sure the API and worker are both running.
2. Create or use an existing lead/draft pair and mark it sent through `POST /api/v1/sending/mark-sent`.
3. Send the real Gmail message through:

```bash
curl -s \
  -X POST \
  -H "x-api-key: YOUR_INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"YOUR_CLIENT_ID","to":"contact@example.com","subject":"Real Gmail reply-sync test","body":"Please reply to this message.","sentMessageId":"YOUR_SENT_MESSAGE_ID"}' \
  http://localhost:3000/api/v1/mailboxes/MAILBOX_ID/test-send
```

4. Reply to that email from the recipient inbox.
5. Run the manual sync endpoint:

```bash
curl -s \
  -X POST \
  -H "x-api-key: YOUR_INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"YOUR_CLIENT_ID"}' \
  http://localhost:3000/api/v1/mailboxes/MAILBOX_ID/sync
```

6. Confirm:
   - the inbound Gmail message was stored in `email_messages`
   - `replies_ingested` is greater than `0`
   - `GET /api/v1/replies/unhandled` shows the new reply after classification/routing if it needs human review
   - future sequence leads for the same contact/campaign moved to `suppressed`

## Gmail Operations Smoke Checks

List connected mailboxes and status:

```bash
curl -s \
  -H "x-api-key: YOUR_INTERNAL_API_KEY" \
  http://localhost:3000/api/v1/mailboxes
```

Run one manual mailbox sync:

```bash
curl -s \
  -X POST \
  -H "x-api-key: YOUR_INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"YOUR_CLIENT_ID","maxResults":50}' \
  http://localhost:3000/api/v1/mailboxes/MAILBOX_ID/sync
```

Run one manual send-ready batch:

```bash
curl -s \
  -X POST \
  -H "x-api-key: YOUR_INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"YOUR_CLIENT_ID","limit":10}' \
  http://localhost:3000/api/v1/sending/process-send-ready
```

Verify mailbox daily-cap behavior:

1. Create an active campaign with `daily_send_limit=1`
2. Put two leads for that campaign into `send_ready`
3. Run `POST /api/v1/sending/process-send-ready`
4. Confirm the first lead sends and the second lead returns `Campaign daily send limit reached.`

Verify opt-out or suppression blocking:

1. Put a lead into `send_ready` for an opted-out, bounced, or suppressed record
2. Run `POST /api/v1/sending/process-send-ready`
3. Confirm the result is blocked with `Suppression or contact state blocks sending.`
4. Confirm the lead status is updated to `suppressed`

Verify reply suppression still works:

1. Send a tracked Gmail message with `sentMessageId`
2. Reply from the recipient inbox
3. Run `POST /api/v1/mailboxes/:id/sync`
4. Confirm the reply is stored and ingested
5. Confirm future sequence leads for the same contact/campaign move to `suppressed`

## Large KB Imports

Large company/contact imports are CLI-first and status-visible through the API.

Available commands:

```powershell
npm run import:preflight
npm run import:companies -- --file .\docs\samples\sample-companies.csv --source-type csv --source-name local-sample
npm run import:contacts -- --file .\docs\samples\sample-contacts.csv --source-type csv --source-name local-sample
npm run import:status -- --batch-id <batch-id>
```

Import characteristics:

- streaming CSV parsing
- bounded chunk commits
- canonical domain/email normalization
- conservative updates only
- source attribution in dedicated tables
- import batch tracking with `running`, `completed`, `partial`, or `failed` status
- dry-run support with `--dry-run`

See [docs/importing-kb.md](docs/importing-kb.md) for required columns, examples, and the exact workflow.

## Deployment Model

The repository includes `render.yaml` for a Render deployment with:

- one managed PostgreSQL instance
- one web service for the API
- one worker service for pg-boss jobs

Web service:

- build: `npm ci --include=dev && npm run build:api`
- start: `npm start`
- env: `START_WORKER=false`

Worker service:

- build: `npm ci --include=dev && npm run build:api`
- start: `npm run worker:prod`

## Operations And Runbooks

- Operator flow: [docs/operator-runbook.md](docs/operator-runbook.md)
- Production operations: [docs/production-ops.md](docs/production-ops.md)
- Launch checklist: [docs/launch-smoke-checklist.md](docs/launch-smoke-checklist.md)
- Import guide: [docs/importing-kb.md](docs/importing-kb.md)

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
npm test
npm audit --omit=dev
```

These validate the application structure, the regression suite, and runtime dependency posture. Full AI and Gmail validation still requires valid external credentials and funded Anthropic billing.

## Security Posture

- `x-powered-by` is disabled.
- Security response headers are applied globally.
- Mutating API requests must use JSON content types.
- Sensitive operational routes are protected behind `x-api-key`.
- Public readiness is limited to `/ready`.
- Request bodies are size-limited.
- Production error responses avoid leaking internal details.
