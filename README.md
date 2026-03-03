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
