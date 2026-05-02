# Production Operations

## Deployment Model

Use the included `render.yaml` blueprint:

- PostgreSQL database
- web service for the API
- worker service for pg-boss

The blueprint uses `npm ci --include=dev` so Render installs exactly the lockfile-pinned dependency tree while still keeping TypeScript build tooling available during the build step.

## Startup Model

- Web service:
  - `START_WORKER=false`
  - serves HTTP only
- Worker service:
  - `npm run worker:prod`
  - processes pg-boss jobs

## Required Production Env Vars

- `DATABASE_URL`
- `ANTHROPIC_API_KEY`
- `VERIFICATION_PROVIDER`
- `VERIFICATION_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_GMAIL_SCOPES`
- `MAILBOX_TOKEN_ENCRYPTION_KEY`
- `INTERNAL_API_KEY`
- `FRONTEND_BASE_URL`
- `NODE_ENV`
- `START_WORKER`

`PORT` is required by the app runtime and is typically provided by the hosting platform for the web service.

## Security Baseline

- Use HTTPS only in production.
- Set a long random `INTERNAL_API_KEY` with at least 32 characters.
- Do not expose `INTERNAL_API_KEY` to browsers or client-side applications.
- Rotate `INTERNAL_API_KEY` if it is ever leaked.
- Store all secrets in the hosting platform secret manager, never in tracked files.
- Treat `/api/v1/ready` as the only public probe.
- Treat `/api/v1/health` and all business routes as authenticated internal endpoints.
- Set a dedicated `MAILBOX_TOKEN_ENCRYPTION_KEY`; do not reuse `INTERNAL_API_KEY`.
- Keep `MAILBOX_TOKEN_ENCRYPTION_KEY` stable across deploys. If it changes, stored Gmail refresh tokens can no longer be decrypted and connected mailboxes must reconnect or undergo a controlled token re-encryption migration.
- Client-scoped mutation endpoints require explicit `client_id` in the JSON body and reject cross-client UUID access with `403`.

## Gmail Production Requirements

- `GOOGLE_REDIRECT_URI` must use the deployed API domain:
  - `https://<api-domain>/api/v1/mailboxes/google/oauth/callback`
- The Google Cloud OAuth web client must include that exact redirect URI.
- Set `GOOGLE_GMAIL_SCOPES` to:
  - `https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify`
- The same Gmail env vars must be present on both the web/API service and the worker service.
- Direct send paths require mailboxes to be active, `connected`, and below the auth-failure quarantine threshold.
- Manual sync can be used for active `unhealthy` mailboxes during recovery, but `disabled` mailboxes remain blocked.

## Migrations

- Migrations run automatically on app startup from `src/db/migrations.ts`.
- Startup is designed to be idempotent against an already-initialized database.
- Roll out the API against a valid PostgreSQL database before starting the worker.

## Backup Policy

Recommended minimum:

- automated daily PostgreSQL backups
- at least 7 retained restore points
- restore test at least once before production launch

## Restore Outline

1. Restore the managed PostgreSQL backup into a recovery database.
2. Point a staging copy of the API at the restored database.
3. Run `GET /api/v1/ready` and `GET /api/v1/health`.
4. Verify counts, audit trail integrity, and queue initialization.
5. Cut over only after verifying expected data.

## Production Troubleshooting Checklist

1. Check `/api/v1/ready`.
2. Check `/api/v1/health`.
3. Confirm web logs show successful startup and migration completion.
4. Confirm worker logs show successful pg-boss startup.
5. Confirm `DATABASE_URL` is present and points to the expected database.
6. Confirm `INTERNAL_API_KEY` is set on both web and worker services.
7. Confirm `FRONTEND_BASE_URL` matches the deployed frontend domain when using onboarding or Gmail OAuth return flows.
8. If AI routes fail, confirm Anthropic billing and key validity.
9. If verification fails, confirm `VERIFICATION_PROVIDER` and `VERIFICATION_API_KEY`.
10. If queue jobs stall, check worker logs and `system_events` for `job.failed`.
