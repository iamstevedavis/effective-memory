# Buffer feasibility gate (#29) — checked 2026-10-15

Status: BLOCKED; no owner-authorized Buffer account/client/channel or public test
media origin is configured in this session. This PR completes research and removes
false stub success only, not the integration. Keep #29 open and this PR draft until
provider implementation/live acceptance is supplied. No external post was attempted.

## Verified official interfaces

- [Quick start](https://developers.buffer.com/guides/getting-started.html): GraphQL
  at https://api.buffer.com. Personal API keys act on the owner's account; do not
  share one global key across customers.
- [Authentication](https://developers.buffer.com/guides/authentication.html): SaaS
  clients use owner OAuth authorization-code + PKCE, registered redirect URI,
  state validation, account:read/posts:read/posts:write and offline_access. Refresh
  tokens rotate on each use; refreshing must hold a durable per-connection lock.
- [Posts and scheduling](https://developers.buffer.com/guides/posts-and-scheduling.html):
  customScheduled + dueAt UTC submits future posts in advance. Scheduled is distinct
  from sent/error. Supported services include Instagram and others; choose and
  verify ONE channel before implementation claims.
- [Image posts](https://developers.buffer.com/examples/create-image-post.html):
  asset image URLs must be provider-fetchable. Private /api/media owner cookies
  cannot be used. Plan narrowly scoped, expiring capabilities for one immutable
  approved artifact; never make draft filenames generally public/enumerable.
- [Rate limits](https://developers.buffer.com/guides/api-limits.html): use response
  Retry-After/RateLimit data with bounded backoff; quotas depend on plan/client.
  Recheck actual limits at connection time; do not hardcode these as posting limits.

No idempotency or reconciliation guarantee is assumed from the createPost examples.
An accepted request followed by a timeout/local write failure is ambiguous: persist
an unknown outcome for manual/provider reconciliation, never blindly create again.
Verify current deletion/cancel and any reschedule contract with the registered
client; refuse unsupported changes instead of changing local dates alone.

## Exact owner actions to unblock

1. Select one permitted test channel/account and register a confidential OAuth app
   in Buffer Settings → API with a canonical callback URL. Confirm API/channel access.
2. Make client ID/secret and a separate encryption key available via runtime secret
   configuration (not this repo/chat/logs). Use authenticated encryption at rest,
   owner/business-bound associated data, and a documented key rotation process.
3. Authorize the selected business connection in the app once implemented; select
   organization/channel, verify it belongs to that connection, and provide a public
   HTTPS test media origin for the capability route. Keep ordinary media private.
4. Explicitly authorize one externally visible synthetic test post, its channel and
   scheduled time before any write. Record redacted external ID/state evidence,
   verify sent/error reconciliation, and confirm cancel/reschedule/disconnect behavior.

## Remaining implementation / merge gate

Owner OAuth connect/select/disconnect; encrypted credential storage with rotating
refresh locking; durable submit/reconcile/cancel jobs in the existing worker;
validated channel/media handling; unique local claims and persisted external IDs;
bounded retries with ambiguity handling; explicit provider-aware lifecycle/audit.
Fixtures must cover auth/429/timeout-after-acceptance/media failure/concurrent workers,
future times, cancel/reschedule, reconciliation and ownership. Live test above remains
mandatory. A fake adapter alone does not complete #29.

Until then, scheduling fails closed. The legacy CLI no longer queries content,
logs captions/reviews, or marks local rows scheduled. A test-only fake returns
provider=fake/status=simulated/confirmed=false and cannot represent real publication.
No credentials, new dependencies, schema changes or production changes in this PR.
