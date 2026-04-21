# Launch Smoke Checklist

Use this checklist in local or staging before launch.

## Boot And Infra

- `npm install`
- `npm run typecheck`
- `npm run build`
- API boots successfully
- Worker boots successfully
- `GET /api/v1/ready` returns `200`
- `GET /api/v1/health` returns `200`

## Auth

- Public `GET /ready` works without `x-api-key`
- Protected `GET /health` returns `401` without `x-api-key`
- Protected route returns `401` with no key
- Protected route returns `401` with wrong key
- Protected route returns `200` with correct key

## Core Workflow

- create company
- create ICP
- create contact
- verify contact
- create campaign
- create lead
- generate draft
- approve or edit draft
- confirm send-ready queue entry
- mark sent
- ingest reply
- handle reply
- log outcome

## Guardrails

- opted-out contact cannot move into `send_ready`
- bounced contact cannot move into `send_ready`
- suppressed company cannot move into `send_ready`
- duplicate open lead creation is blocked
- company/contact mismatch on lead creation is blocked

## Queue Checks

- enqueue score-all
- enqueue verify-batch
- enqueue enrich-batch
- enqueue generate-drafts
- ingest reply and confirm classify enqueue attempt

## Reporting

- review queue
- review stats
- sending stats
- memory performance
- draft quality
- outcomes by campaign
- audit trail

## External Dependency Checks

- Anthropic key valid and funded
- MillionVerifier key valid
