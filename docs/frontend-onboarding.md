# Frontend Marketing And Onboarding MVP

## Purpose

This frontend now has two jobs:

- present `integ-outbound.com` as a credible public-facing marketing and onboarding site
- provide a narrow onboarding and visibility surface for early clients and operators

It supports:

- public positioning pages for prospects, early clients, and potential backers
- client signup and onboarding
- Gmail OAuth connection through the existing backend
- operator visibility into onboarding, review, and safety state
- a placeholder for future Google Calendar connection

It intentionally does **not** support:

- a full self-serve SaaS dashboard
- client-side campaign launch
- send controls
- lead creation
- browser access to `INTERNAL_API_KEY`

## App Paths

- Frontend app: `apps/web`
- Backend API: `api.integ-outbound.com`
- Frontend domain target: `integ-outbound.com`

## Frontend Env Vars

Set these in `apps/web/.env.local` or your production frontend secret manager:

- `BACKEND_API_URL`
  - local example: `http://localhost:3000`
  - production example: `https://api.integ-outbound.com`
- `INTERNAL_API_KEY`
  - same internal key used by the backend
  - server-side only
- `FRONTEND_BASE_URL`
  - local example: `http://localhost:3001`
  - production example: `https://integ-outbound.com`
- `FRONTEND_SESSION_SECRET`
  - long random value used to sign onboarding and operator cookies
  - do not reuse `INTERNAL_API_KEY`

Production frontend values:

- `BACKEND_API_URL=https://api.integ-outbound.com`
- `FRONTEND_BASE_URL=https://integ-outbound.com`
- `FRONTEND_SESSION_SECRET=<secret>`
- `INTERNAL_API_KEY=<server-only secret>`

## Backend Env Vars Used By The Frontend Flow

Set these on the backend/API service:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_GMAIL_SCOPES`
- `MAILBOX_TOKEN_ENCRYPTION_KEY`
- `INTERNAL_API_KEY`
- `FRONTEND_BASE_URL`

Production callback:

- `https://api.integ-outbound.com/api/v1/mailboxes/google/oauth/callback`

Production backend values:

- `FRONTEND_BASE_URL=https://integ-outbound.com`
- `GOOGLE_REDIRECT_URI=https://api.integ-outbound.com/api/v1/mailboxes/google/oauth/callback`

## OAuth Flow

1. Client signs up through `/signup`.
2. Frontend server route creates the client profile through `POST /api/v1/clients/signup`.
3. Frontend stores a signed onboarding cookie on `integ-outbound.com`.
4. Client clicks `Connect Gmail` on `/onboarding/connect-gmail`.
5. Frontend server route calls:
   - `GET /api/v1/mailboxes/google/oauth/start?client_id=<client_id>&redirect_to=<frontend-url>`
6. Backend verifies the client exists.
7. Backend signs the OAuth state with `client_id` and `redirect_to`.
8. Google redirects back to:
   - `https://api.integ-outbound.com/api/v1/mailboxes/google/oauth/callback`
9. Backend attaches the mailbox to the signed `client_id`.
10. Backend redirects back to the requested frontend onboarding URL.

## Client Onboarding Flow

- `/`
  - public marketing landing page with CTA to onboarding
- `/about`
  - founder-led positioning and scope
- `/what-we-do`
  - software-plus-service workflow explanation
- `/products`
  - offer cards for pilot, managed execution, infrastructure, and onboarding
- `/pricing`
  - indicative pricing ranges only, not binding terms
- `/faq`
  - practical prospect answers, including Gmail OAuth explanation
- `/signup`
  - creates the client profile
- `/onboarding`
  - onboarding checklist
- `/onboarding/connect-gmail`
  - Gmail connection action only
- `/onboarding/calendar`
  - placeholder only
- `/dashboard`
  - read-only client-facing status

## Operator Flow

- `/operator/login`
  - validates the internal API key server-side
- `/operator`
  - high-level overview
- `/operator/clients`
  - onboarding status by client
- `/operator/review`
  - lead/reply review queues
- `/operator/safety`
  - send safety and sync safety counters

## Security Warnings

- Never expose `INTERNAL_API_KEY` to client-side code.
- All backend calls from the browser must go through server-rendered pages or frontend server routes.
- The onboarding cookie is signed with `FRONTEND_SESSION_SECRET`.
- The operator cookie is signed separately from browser input and only set after server-side validation.
- `GET /api/v1/mailboxes/google/oauth/start` now requires `client_id`.
- The OAuth callback binds the mailbox to the signed `client_id`; it does not create orphan mailbox ownership.
- Multi-client write isolation must remain enforced in the backend before any future client-facing mutation actions are added.
- Public marketing pages must not call protected operator APIs.
- Client-facing pages remain read-only for operational state; no self-serve sending is exposed yet.

## Public Site Purpose

The public site is meant to:

- explain what Integ does without overstating current automation maturity
- convert qualified interest into a controlled pilot conversation
- direct prospects into `/signup` as the onboarding CTA
- show indicative pricing and workflow clarity without opening self-serve campaign controls

The pricing page is intentionally indicative rather than binding. Final scope still depends on market, data requirements, send volume, inbox setup, and delivery expectations.

## Calendar Future Scope

Google Calendar is intentionally a placeholder in this MVP.

Do not request Calendar scopes until backend support exists for:

- Calendar OAuth flow
- stored Calendar connection state
- availability or scheduling logic
- client-safe calendar status APIs

## Domain And DNS Notes

Recommended production layout:

- apex `integ-outbound.com` -> frontend hosting target
- `www.integ-outbound.com` -> frontend hosting alias or redirect
- `api.integ-outbound.com` -> backend/API hosting target

Typical setup:

- add `A`, `ALIAS`, or provider-specific apex record for `integ-outbound.com`
- add `CNAME` for `www`
- add `CNAME` or provider target for `api`
- provision TLS certificates for both the frontend and API domains

## Frontend Host Setup

Recommended first controlled deployment:

- host `apps/web` on Vercel or an equivalent Next.js-capable frontend host
- configure the project root to `apps/web`
- set all frontend env vars as server-side runtime env vars
- bind:
  - `integ-outbound.com`
  - `www.integ-outbound.com`
- keep `api.integ-outbound.com` pointed at the backend host

Suggested commands:

```powershell
npm install
npm run typecheck
npm run build
npm test
```

Frontend-only build commands:

```powershell
npm run build --workspace apps/web
npm run start --workspace apps/web
```

## Controlled Deployment Checklist

1. Confirm frontend env vars are set on the frontend host.
2. Confirm backend env vars are set on the API host, including `FRONTEND_BASE_URL`.
3. Confirm Google OAuth web client includes:
   - `https://api.integ-outbound.com/api/v1/mailboxes/google/oauth/callback`
4. Confirm `integ-outbound.com` and `api.integ-outbound.com` both have valid TLS.
5. Confirm operator uses `/operator/login` and not raw backend endpoints from a browser.

## Manual Smoke Checklist

1. Frontend homepage loads at `https://integ-outbound.com/`.
2. Submit `/signup` with a test client profile and confirm it redirects to `/onboarding`.
3. Confirm the onboarding page shows the created client and checklist state.
4. Click `Connect Gmail` and confirm the browser is redirected to Google OAuth from:
   - `GET /api/v1/mailboxes/google/oauth/start?client_id=<client_id>&redirect_to=<frontend-url>`
5. Complete or cancel OAuth and confirm the redirect returns to the onboarding flow.
6. Open `/operator/login`, enter the internal key, and confirm `/operator` loads.
7. Confirm `/operator`, `/operator/clients`, `/operator/review`, and `/operator/safety` all load.
8. Confirm there are no client-visible campaign launch, send, or lead creation controls anywhere in the frontend.

## Runtime Notes

- Root `npm run build` includes the backend build and the `apps/web` build.
- `apps/web` also builds cleanly with its own workspace command.
- The frontend build does not require live secrets at compile time; the server-side env contract is read at runtime by route handlers and server-only modules.
- Calendar remains a placeholder only in this deployment.
