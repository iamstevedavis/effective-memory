# PraiseLoop

Turns existing customer reviews into ready-to-post social media content for local
businesses: deterministic quote selection, AI captions in the brand voice, branded
image rendering, and a human-in-the-loop approval queue.

## Prerequisites

- Node.js 22+ and npm 10+ (see `.nvmrc`)
- Docker with the Compose plugin (runs Postgres and Redis containers)

## Quickstart — host + containers (recommended for development)

```bash
cp .env.example .env
npm ci
docker compose up -d postgres redis
npm run db:migrate
npm run db:health
npm run dev        # web on http://localhost:3000
npm run worker     # in another terminal: draft generation loop
```

## Quickstart — all containers (development, hot reload)

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

The dev override runs `next dev` and mounts the repository into the web/worker
containers. Migrations run once before web/worker start.

## Quickstart — all containers (production-style)

```bash
cp .env.example .env
docker compose up --build
```

Runs migrations once, then starts the built web app (`next start`) and the
compiled worker. Generated images are shared between worker and web via the
`generated_media` volume. Put this behind a reverse proxy; only port 3000 is
published.

## Configuration

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | `...@localhost:5432/...` on the host, `...@postgres:5432/...` in containers |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | yes (containers) | Defaults in `.env.example`; do not rename the database/volumes (data lives there) |
| `OPENAI_API_KEY` | no | Enables caption generation; without it the worker marks affected drafts `failed` with an actionable error instead of crashing |
| `DRAFT_PIPELINE_INTERVAL_MS` | no | Worker sweep interval (default `60000`) |
| `REDIS_URL` | no | Reserved for future queue work; unused by the current worker |

Postgres and Redis ports are bound to loopback (`127.0.0.1`) only — reachable
from the host, not exposed to the network.

## Database migrations

- `npm run db:migrate` — applies SQL files from `db/migrations` in filename order; applied files are recorded in `schema_migrations`
- `npm run db:health` — connectivity check

## Tests, lint, typecheck, build

```bash
npm test          # draft pipeline + branding routes + tooling regressions (synthetic, no external services)
npm run lint      # ESLint
npm run typecheck # tsc --noEmit
npm run build     # next build
```

## Worker

- `npm run worker` — draft generation loop (quote selection → captions → image render) every `DRAFT_PIPELINE_INTERVAL_MS`
- `npm run worker:schedule` — one-shot scheduling sweep for approved, due drafts (stub adapter)

## Production deployment notes

- `docker compose up --build` is the production-style path: multi-stage builds, deterministic `npm ci`, healthchecks, bounded shutdown (`stop_grace_period`), shared media volume, loopback-only database/Redis ports.
- Restart safety: database and generated media live in named volumes (`postgres_data`, `generated_media`); container restarts preserve them.

## Current limitations

- Scheduler is a stub adapter; no direct social publishing yet
- Redis is provisioned but unused (queue work is planned, see `DECISIONS.md`)
- Manual CSV review import only
- No authentication/authorization yet
