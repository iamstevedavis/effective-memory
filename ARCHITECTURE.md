# ARCHITECTURE.md

## Tech stack

Define and maintain the core stack in this section as the source of truth:

### Runtime(s)

- Node.js (TypeScript)

### Framework(s)

- Next.js (app + API routes) for web UI + API surface
- Worker process for background jobs (separate entrypoint)

### Data store(s)

- Postgres (primary datastore)
- Redis (job queue + caching) via BullMQ
- If we later want fewer moving parts, we can consider a Postgres-backed queue, but start with Redis for maturity.

### Infrastructure / deployment model

- Docker Compose on VPS for MVP:
  - web: Next.js
  - worker: background jobs
  - postgres
  - redis
  - (optional) object storage: S3-compatible (MinIO) for generated images

### Testing and CI tooling

- Unit: Vitest
- Integration: Docker-based (Postgres/Redis) + API tests
- Lint/format: ESLint + Prettier
- CI: GitHub Actions (lint, typecheck, test)

## Key patterns

### Product boundaries (modules)

- Ingestion: review sources → normalized Review records
- Curation: quote selection + ranking
- Generation: captions + variants + metadata
- Rendering: templates → images
- Scheduling: publish/schedule integration (scheduler-first)
- Approval: human-in-the-loop state machine for drafts

### Data flow rules

- All writes go through the API layer (no direct DB writes from UI)
- Worker consumes jobs and writes results back to Postgres
- Rendering is deterministic from (template + brand + quote + caption)

### State machine (draft lifecycle)

- ImportedReview → CandidateQuote → DraftPost → Approved → Scheduled → Published (best-effort)
- Every transition is stored with timestamps for audit/debugging

### Error handling and observability

- All external API calls must be wrapped with:
  - timeouts
  - retries with backoff (bounded)
  - structured logging including request IDs
- Record "why failed" in job metadata; never silently drop jobs

### Security / privacy

- Never store OAuth refresh tokens unencrypted at rest
- Do not store more customer review data than needed (quote + rating + date + source id)
- No secrets in repo; env vars only

## Directory structure

```text
.
├─ PRODUCT.md
├─ ARCHITECTURE.md
├─ DECISIONS.md
├─ WORKFLOW.md
├─ docker/
├─ src/
│  ├─ app/          # Next.js app (UI)
│  ├─ api/          # API routes / handlers
│  ├─ core/         # domain logic (ingestion/curation/generation/rendering/scheduling)
│  ├─ db/           # schema, migrations, queries
│  ├─ worker/       # background job runners
│  ├─ integrations/ # Google/Buffer/etc adapters
│  └─ shared/       # shared utilities/types
└─ tests/
```

## Don’t do X

- Don’t add new frameworks without a documented decision (`DECISIONS.md`)
- Don’t let UI talk directly to external APIs (go through our API)
- Don’t embed secrets/tokens in logs
- Don’t auto-post without an explicit approval step (MVP)
