# Durable weekly generation (#43)

Run `npm ci`, `npm run db:migrate` (008), configure `REDIS_URL`, and run `npm run worker`.
Compose wires Redis into the worker. BullMQ 6 handles durable delivery; Postgres
is the authoritative outbox/claim/quota store, so lost Redis deliveries are rebuilt.
The worker scans every 60s (minimum configurable 5s), not five new drafts per tick.
Only owned businesses participate. Import settings exposes weekly target 1–5,
default 3; changes apply to the next Monday-based business-local generation period.

A business-row transaction reserves review/draft jobs and counts all initial drafts
against the same period budget. Up to five pending/running/retrying jobs per business
bound backlog across rollover. Historical duplicates and their relationships remain
intact, but new canonical review→draft mappings are unique. Existing incomplete
current-period drafts are adopted instead of replaced. `generation_periods` persists
allocated/completed counts and quota_met/reviews_exhausted/backlog_full/queued reasons.

Claims have 90s renewable leases, three automatic attempts, 30s/60s backoff and
sanitized error codes. Caption calls time out at <=30s. Persisted caption/image
stages are reused after failures/restarts; a crash after a provider accepted a call
but before local persistence can require another call. Attempts and per-owner daily
counters bound that exposure; exactly-once paid calls are not promised.

`GET /api/generation?businessId=...` exposes only owner-authorized state. Existing
quote selection POST now queues generation (202), never a second synchronous AI
pipeline. `POST /api/generation/retry` takes draftPostId, only retries an exhausted
failed job, and permits at most two owner-triggered retries. Successful drafts stay
in draft status and require human approval. Do not manually reset a job's counters.

Validate with `TEST_DATABASE_URL=... TEST_REDIS_URL=redis://localhost:56379 npm test`.
Tests use isolated Postgres schemas and a uniquely named Redis queue; fake-provider
calls verify quota rollover, concurrent claims, lost Redis delivery, crashed leases,
retained stages, bounded retries and redaction. No provider key is used. Redis/db
access needs to remain internal; the public worker has no authentication bypass.
Rollback: stop the worker before reverting, retain new job/period tables and draft
reference annotations. Do not run the former unbounded timer-loop worker on live data.
