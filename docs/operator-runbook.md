# Operator Runbook

This backend is designed for an internal operator-led outbound workflow.

## Normal Flow

1. Create or import companies.
2. Create or update the active ICP.
3. Score companies and review the shortlist.
4. Create contacts and verify them.
5. Create a campaign.
6. Create leads for campaign + company + contact combinations.
7. Enrich target companies when needed.
8. Generate drafts.
9. Review drafts:
   - approve
   - reject
   - edit
10. Pull the send-ready queue.
11. Send through your external sending infrastructure.
12. Mark messages as sent or bounced.
13. Ingest replies.
14. Handle or route replies.
15. Log outcomes.

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
- `POST /leads`
- `POST /enrichment/:companyId`
- `POST /drafts/generate/:leadId`
- `POST /drafts/:draftId/approve`
- `GET /sending/queue`
- `POST /sending/mark-sent`
- `POST /replies/ingest`
- `POST /replies/:id/handled`
- `POST /outcomes`

## API Key Requirement

All protected routes require:

```text
x-api-key: your_internal_api_key
```

Only `/health` and `/ready` are public.
Only `/ready` is public. `/health` is protected because it contains operational counts.
