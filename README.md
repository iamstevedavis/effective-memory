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
| `DATABASE_URL` | yes (host exec) | Host execution connects to `...@localhost:5432/...`; Compose services build their own URL from `POSTGRES_*` via the `postgres` service name |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | yes (containers) | Defaults in `.env.example`; do not rename the database/volumes (data lives there) |
| `OPENAI_API_KEY` | no | Enables caption generation; without it the worker marks affected drafts `failed` with an actionable error instead of crashing |
| `OPENAI_TIMEOUT_MS` | no | Caption provider timeout in milliseconds (default `20000`); on timeout the draft is marked `failed` with an actionable error |
| `DRAFT_PIPELINE_INTERVAL_MS` | no | Worker sweep interval (default `60000`) |
| `MEDIA_ROOT` | no | Where rendered draft images are written/served (default `public/generated`, the `generated_media` volume mount in Compose) |
| `REDIS_URL` | no | Reserved for future queue work; unused by the current worker |

Postgres and Redis ports are bound to loopback (`127.0.0.1`) only — reachable
from the host, not exposed to the network.

## Database migrations

- `npm run db:migrate` — applies SQL files from `db/migrations` in filename order; applied files are recorded in `schema_migrations`
- `npm run db:health` — connectivity check

## Tests, lint, typecheck, build

```bash
npm test          # pipeline + branding routes + caption decoding + media smoke + tooling regressions (synthetic, no external services)
npm run lint      # ESLint
npm run typecheck # tsc --noEmit
npm run build     # next build
```

### Opt-in live-provider verification

`npm test` never calls the paid provider. To verify caption decoding against
the real OpenAI Responses API (one paid call):

```bash
LIVE_PROVIDER_VERIFY=1 OPENAI_API_KEY=sk-... npm run test:live
```

Without `LIVE_PROVIDER_VERIFY=1` and `OPENAI_API_KEY` the script reports the
skip honestly and exits 0, so CI stays green without credentials.

## Worker

- `npm run worker` — draft generation loop (quote selection → captions → image render) every `DRAFT_PIPELINE_INTERVAL_MS`
- `npm run worker:schedule` — one-shot scheduling sweep for approved, due drafts (stub adapter)

## Production deployment notes

- `docker compose up --build` is the production-style path: multi-stage builds, deterministic `npm ci`, healthchecks, bounded shutdown (`stop_grace_period`), shared media volume, loopback-only database/Redis ports.
- Restart safety: database and generated media live in named volumes (`postgres_data`, `generated_media`); container restarts preserve them.
- Image delivery: the worker writes PNGs into the shared `generated_media` volume; the web container serves them via `GET /api/media/<filename>` (see `app/api/media/[name]/route.ts`). Browsers should always use the `/api/media/...` URL stored in `draft_posts.image_path` — never a bare `public/generated/...` path, because runtime-written files under `public/` are not guaranteed to be served by the Next production server.

## Current limitations

- Scheduler is a stub adapter; no direct social publishing yet
- Redis is provisioned but unused (queue work is planned, see `DECISIONS.md`)
- Manual CSV review import only
- No authentication/authorization yet

Quote-card rendering uses Sharp/Pango measured wrapping (DejaVu Sans/Serif), a
1080px canvas, 80px safe margins, and automatic black/white contrast. Names fit
within 160px and quotes within 650px at 32–48px; unfit text is rejected verbatim,
never truncated. Supply optional logos as PNG/JPEG/WebP base64 data URLs (256 KB,
4 MP maximum); remote URLs/SVG/animation are rejected without network requests.
Manual and worker generation use the same tone/colors/logo. Regenerate explicitly
after brand changes. `IMAGE_EVIDENCE_DIR=/tmp/evidence npm test` saves synthetic PNGs.

Quote rendering uses DejaVu with Noto core/CJK fallback fonts in both runtime images, including for Chinese, Japanese, Korean and other supported Unicode scripts. Host installations must install the same font packages before rendering.
Template settings: Import → Branding settings → Quote text size → sample preview →
Save. `quote-card-v1` is the single supported template. Standard fits quotes at
32–48px; Large uses 40–56px and may reject longer quotes. Settings live in
`businesses.brand_colors` with data-preserving defaults in migration 005; run
`npm run db:migrate`. Color controls choose readable black/white text automatically.
Saving settings never changes existing draft images; explicitly regenerate and
review a new image. `TEST_DATABASE_URL=postgres://... npm test` also verifies real
Postgres migration preservation and settings round-trip in a disposable schema.

CSV imports are limited to 1 MB / 1000 logical rows; quoted multiline cells are
supported. Optional `source_review_id` and `source_url` preserve manual-source
provenance. Reimports use a database-unique per-business/source ID, or a normalized
(rating/text/author/UTC millisecond date) fingerprint. Fingerprints cannot identify
edited reviews without stable IDs. Original text is retained. Migration 006 keeps
all historical duplicates and draft references, marks extra rows `duplicate_of`,
and prevents those rows entering new quote selection. UI reports imported,
duplicate, empty, invalid and storage-failed rows, with at most 20 redacted errors.
Ownership enforcement is supplied by #42 before any customer exposure.
