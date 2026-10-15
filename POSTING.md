# Weekly slots (#28)

Status: local planning/reservation implementation; real scheduling acceptance is
blocked by #29's unavailable Buffer connection. This PR stays draft; no real
posting/scheduling outcome is claimed. Fake fixtures cannot complete live acceptance.

Run migration 010. Approval → Weekly posting slots: choose weekdays/local times,
save, review the list showing business timezone AND UTC, select complete approved
drafts, then explicitly confirm. Default is Tue/Thu/Sat 10:00 business-local time.
Proposals cover the next 35 days, skip past/occupied slots, and never approve posts.
Changing timezone/settings does not move any already reserved/submitted UTC instant.

DST policy: nonexistent local times advance minute-by-minute to the next valid
local minute; repeated times choose the earlier instant. Slot generation does not
use the browser timezone. Only validated IANA zones and unique weekdays are accepted.

Business/draft locks and unique durable slot/draft claims serialize reservations.
Claims commit BEFORE provider submission. Ambiguous timeouts or accepted-provider
requests followed by local failure keep the claim pending/unknown, preventing blind
resubmission and edits. Verified provider acceptance alone changes status to scheduled
and creates an actor/time/reason audit event. A known unconfigured provider releases
the unused claim and returns an accurate per-item 503; approved drafts stay approved.
Generic editing/rescheduling is refused while a provider claim exists; #29 must
supply explicit cancellation/reconciliation before those claims can be released.
No timer expires an ambiguous claim and no exactly-once remote promise is made.

`TEST_DATABASE_URL=... npm test` covers DST, rollout/occupied/exhausted slots, stale
and foreign IDs, concurrency, unavailable providers and local failure after fixture
acceptance. `TEST_BROWSER=1 TEST_DATABASE_URL=... npx ts-node scripts/test-slots-browser.ts`
(after build, with Chromium) verifies settings reload, a different browser timezone,
UTC/local preview, explicit assignment and honest unconfigured-provider failure.
The injected provider receipt tests are synthetic contracts, not live Buffer evidence.

No provider credential/media exposure or new dependency. Rollback: stop assignment
requests, retain claim records and existing UTC timestamps; never delete pending or
unknown claims without resolving their remote outcome. Existing historical schedules
are excluded from proposals without rewriting or deleting them.
