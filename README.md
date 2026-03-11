# effective-memory

Reviews → Social MVP scaffold.

## Local dev quickstart

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis
npm run db:migrate
npm run db:health
npm run dev
# in another terminal
npx ts-node worker/index.ts
```

Or run everything in containers:

```bash
cp .env.example .env
docker compose up --build
```

`docker compose up` runs a one-shot `migrate` service first, then starts `web` and `worker` after migrations complete.

## Database

- Migration tool: lightweight TypeScript runner (`scripts/migrate.ts`) executing SQL files from `db/migrations`.
- Apply migrations: `npm run db:migrate`
- Health check query: `npm run db:health`
- Query helper: `lib/db.ts` (`query(...)` over `pg` pool)

## Manual CSV import (MVP)

- UI page: `/import`
- Create/select a business, upload CSV, and import reviews into `reviews` with `source="manual"`.
- Supported CSV columns:
  - required: `rating`, `text`, `reviewed_at` (ISO)
  - optional: `author_name`

## Quote selector v1 (deterministic) + caption generation + image rendering

- UI page: `/quotes`
- Runs a deterministic selector for a business and persists top-N quote candidates in `draft_posts`.
- Heuristics:
  - prefer 4–5 star reviews
  - prefer 30–200 character quotes
  - reject profanity matches
  - boost keyword matches (`food`, `service`, `clean`, `friendly`, etc.)
- Caption generation endpoint returns 3 AI variants (`friendly`, `premium`, `playful`) and lets you save selected caption to `draft_posts.caption_text`.
- Branded image rendering endpoint generates PNGs in local storage (`public/generated`) and saves path to `draft_posts.image_path`.
- Requires `OPENAI_API_KEY` in environment for caption generation.

## Approval queue

- UI page: `/approval`
- Lists draft posts grouped by status (`draft`, `approved`, `scheduled`)
- Supports transitions:
  - draft -> approved
  - approved -> draft
- Supports setting `scheduled_for` datetime for approved drafts.
- Persists optional `audit_note` and updates `updated_at` on each transition.

## Draft generation worker

- Worker entrypoint: `worker/index.ts`
- Automatically runs quote selection -> caption generation -> image render for each business on a timer.
- New draft candidates are created in `draft_posts` with:
  - `quote_text` from selector
  - `caption_text` from caption generator (friendly variant)
  - `image_path` from renderer output
- Duplicates are avoided by skipping reviews already linked to an existing draft.

## Scheduling (stub adapter)

- Scheduler adapter interface: `lib/integrations/scheduler.ts`
- Stub implementation logs structured scheduling payload and returns `scheduled`.
- Worker command: `npm run worker:schedule`
  - picks up rows with `status='approved'` and due `scheduled_for`
  - marks rows `status='scheduled'` after adapter call
