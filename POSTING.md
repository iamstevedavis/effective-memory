# Timezone-aware posting slots (#28)

Run migration 010, configure owner login (AUTH.md), and ensure the durable worker/Redis is running (GENERATION.md). The Schedule page (`/schedule`) shows the PostingSlots component for the business selected in the app shell.

## Flow

1. Owner sets weekly posting slots (weekday + local time) on the Schedule page. Times are stored in business timezone.
2. On confirm, the system proposes the next 5 available UTC slots (skipping occupied) using business timezone with correct DST resolution.
3. Each selected approved draft gets a durable claim on a specific UTC instant before any provider call.
4. Provider submission is attempted; only verified Buffer "scheduled" receipts confirm the claim and set `draft_posts.status=scheduled`.
5. Failed/unknown provider results leave the claim in `unknown` state; draft stays `approved` for retry.

## DST handling

- `localSlotInstant` searches forward up to 24h for the next valid local minute.
- Nonexistent minutes (spring forward) resolve to the next valid minute.
- Repeated minutes (fall back) use the earliest UTC instant.
- Verified by `test-posting-slots.ts` for America/New_York, Australia/Lord_Howe.

## Acceptance

- `proposeSlots` returns future UTC instants matching the configured weekdays/times.
- `assignSlots` enforces ownership, draft completeness (caption + available image), version match, and slot availability.
- Concurrent assignment to the same slot is prevented by unique claim.
- Provider-unavailable returns 503 with no claim persisted.
- Ambiguous provider response marks claim `unknown`; draft remains `approved`.
- Confirmed provider receipt updates claim to `confirmed`, sets `external_id`, and moves draft to `scheduled`.
- Local confirmation failure after provider success leaves claim `pending`; draft stays `approved` (cannot resubmit same slot).

## Tests

- Unit: `scripts/test-posting-slots.ts` - DST/rollover, ownership, concurrency, ambiguous acceptance, provider fixtures
- Browser: `scripts/test-slots-browser.ts` - Chromium flow: schedule edit, confirm, provider failure, browser/business timezone persistence, branding logo upload/remove
- Run with `TEST_DATABASE_URL=... npm test` (unit) and `TEST_BROWSER=1 TEST_DATABASE_URL=... CHROMIUM_PATH=... npx ts-node scripts/test-slots-browser.ts` (browser)

## Boundaries

- No automatic scheduling; owner explicitly confirms each batch.
- Real scheduling requires verified Buffer connection (#29). Without it, assign returns 503.
- Cancel/reschedule not yet supported; requires #29 provider operations.
- Maximum 5 slots per weekly batch (MVP limit).

## Rollback

Stop writes, retain `posting_slot_claims` and `businesses.posting_slots`. Migration 010 is additive.