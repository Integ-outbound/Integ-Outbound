# Production Operations

## Deployment Model

Use the included `render.yaml` blueprint:

- PostgreSQL database
- web service for the API
- worker service for pg-boss

## Startup Model

- Web service:
  - `START_WORKER=false`
  - serves HTTP only
- Worker service:
  - `npm run worker`
  - processes pg-boss jobs

## Required Production Env Vars

- `DATABASE_URL`
- `ANTHROPIC_API_KEY`
- `VERIFICATION_PROVIDER`
- `VERIFICATION_API_KEY`
- `INTERNAL_API_KEY`
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
7. If AI routes fail, confirm Anthropic billing and key validity.
8. If verification fails, confirm `VERIFICATION_PROVIDER` and `VERIFICATION_API_KEY`.
9. If queue jobs stall, check worker logs and `system_events` for `job.failed`.
