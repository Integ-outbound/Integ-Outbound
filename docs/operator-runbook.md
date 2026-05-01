# Operator Runbook

This backend is designed for an internal operator-led outbound workflow.

## Normal Flow

1. Create or import companies.
2. Create or update the active ICP.
3. Score companies and review the shortlist.
4. Create contacts and verify them.
5. Create or select a client.
6. Create a campaign for that client.
7. Create leads for campaign + company + contact combinations.
8. Enrich target companies when needed.
9. Generate drafts.
10. Review drafts:
   - approve
   - reject
   - edit
11. Pull the send-ready queue.
12. Send through your external sending infrastructure.
13. Mark messages as sent or bounced.
14. Ingest replies.
15. Review suggested replies when the system routes an inbound message to human review.
16. Handle or route replies.
17. Log outcomes.

## Important Constraints

- The backend can send through connected Gmail mailboxes, but only through internal operator or worker-controlled flows.
- A lead cannot enter `send_ready` if:
  - the contact has opted out
  - the contact has bounced
  - the company is suppressed
- All write paths create `system_events`.

## Minimum Operator Endpoints

- `POST /companies`
- `POST /icp`
- `GET /icp/shortlist`
- `POST /contacts`
- `POST /contacts/:id/verify`
- `POST /campaigns`
- `GET /clients`
- `POST /clients`
- `POST /leads`
- `POST /enrichment/:companyId`
- `POST /drafts/generate/:leadId`
- `POST /drafts/:draftId/approve`
- `GET /operator/status`
- `GET /operator/review`
- `GET /sending/queue`
- `POST /sending/mark-sent`
- `POST /replies/ingest`
- `POST /replies/:id/suggested-reply`
- `POST /replies/:id/review-response`
- `POST /replies/:id/handled`
- `POST /outcomes`

## API Key Requirement

All protected routes require:

```text
x-api-key: your_internal_api_key
```

Client-scoped queues and operator endpoints also accept an optional `client_id` to isolate review, send, mailbox, and reply work per client.

Only `/health` and `/ready` are public.
Only `/ready` is public. `/health` is protected because it contains operational counts.
