# Resumable first drafts (#30)

Run migrations through 011, configure owner login (AUTH.md), and start the durable
worker/Redis (GENERATION.md). Home → Start or resume business onboarding. No Google
connection, billing, automatic approval or publishing is required.

1. Sign in, enter business name (1–120 characters), IANA timezone, colors and tone.
   Optional PNG/JPEG/WebP logo is validated before saving (256 KB / 4 MP); remote
   URLs/SVG/animation are rejected. Synthetic preview reuses the shared template.
2. Import a CSV or download the synthetic sample. Inspect persisted totals/bounded
   row errors. Duplicate imports are safe. Add more reviews if there are fewer than
   three eligible 4–5 star, 30+ character, suitable reviews after curation.
3. Explicitly queue up to three drafts (default weekly target three). Existing jobs
   and onboarding share the same weekly budget. Poll persisted state; auto-retries
   retain successful stages. Exhausted jobs offer bounded owner retry; fix branding
   on the Brand page before retrying rendering failures.
4. Open the actual owner-protected images and captions. “Usable previews” appears
   only after each image loads. Review in approval selects the saved business;
   the owner decides what to edit/approve. Real publishing still depends on #29.

Saved steps resume from owner-scoped database records and the business URL. A
sessionStorage UUID only deduplicates initial business creation; no review text,
logo or form content is stored there. Concurrent retries with the same owner/key
return the existing business. Unsaved initial form fields and file selections must
be entered again after reload. Expired sessions clear the wizard's loaded data.
Public sample CSV ships in the web image; private/generated media is excluded from
Docker build context and still requires owner-authorized image access.

## Actual timed evidence (2026-10-15)

Chromium production-server walkthrough: **5.46–5.70 seconds**, synthetic session and
injected caption provider, real Postgres and Sharp rendering. Included malformed
CSV, an insufficient first review, duplicate setup requests, reload/resume,
provider failure/recovery, adding reviews, and three 1080px previews. This is an
AUTOMATED synthetic timing, not a human/live-provider result or product SLA.
Live OAuth/provider latency and a human manual timing are not verified here.

Reproduce after build with `TEST_BROWSER=1 TEST_DATABASE_URL=... npx ts-node scripts/test-onboarding-browser.ts`.
Requires Chromium (CHROMIUM_PATH). The test invokes the real worker handler with
fixture captions and the real renderer; BullMQ delivery is covered separately.
`TEST_DATABASE_URL=... npm test` also verifies setup idempotency, owner isolation,
logo/timezone validation and database resume. No paid calls occur in ordinary tests.

Owner manual timing: start when business setup opens after sign-in; stop only when
all three image/caption previews visibly load. Record provider mode, failures,
review availability and elapsed time; do not substitute synthetic seconds for this
measurement. Retry/reload must retain the same business/import/job counts. Document
live results separately when owner credentials and a permitted setup are available.
Rollback: stop writes, retain onboarding keys and all existing business/review/job
records. No data is deleted by migration 011.

CI now supplies disposable Postgres/Redis services and installs matching Playwright
Chromium so database and all four browser/HTTP flows run instead of being skipped.

Resume without an explicit business ID prefers the latest saved onboarding business, falling back to the latest owned legacy business. An explicit owned business ID selects another business. Progress shows the newest five drafts, so old archived attempts do not permanently hide newer previews.
