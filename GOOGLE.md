# Google Business Profile feasibility (#46) — checked 2026-10-15

Status: BLOCKED. No approved developer project, OAuth client/owner grant, verified
permitted live location, or confirmed review-reuse policy interpretation is
available in this session. No account configuration, API call, scraping or mock
connector is presented as completion. Issue #46 stays open.
P2 delivery also waits for the paid-pilot demand evidence specified by the issue.

## Current official references

- [Prerequisites](https://developers.google.com/my-business/content/prereqs): API
  access requires an approved developer project. The applicant must manage an
  active verified profile for at least 60 days, with its business website present.
  Request basic access through the official form with the project number using an
  owner/manager email; zero quota is not proof of access. Enable APIs after approval.
- [OAuth implementation](https://developers.google.com/my-business/content/implement-oauth):
  use owner consent with business.manage scope. This broad management scope is not
  a product authorization to edit profiles/reviews; our connector must remain read-only.
- [Review list](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list):
  verified location required; accounts/*/locations/* parent, at most 50 per page,
  pageToken/nextPageToken and updateTime-desc ordering. No documented changed-since
  cursor is assumed; stable review IDs and durable pagination checkpoints are needed.
- [Review data](https://developers.google.com/my-business/content/review-data):
  review ID, comment, rating, reviewer/create time support provenance. Do not invent
  a review permalink when the response does not provide one.
- [API policies](https://developers.google.com/my-business/content/policies):
  authorization, attribution, termination and content-storage obligations apply.
  Limited cached content has a temporary 30-day ceiling and restrictions on
  manipulation/aggregation. Third-party projects and access have additional rules.

The product currently retains reviews and turns them into edited social graphics.
We cannot assume that indefinite storage or off-platform reuse is permitted by
API access or business-owner consent alone. Obtain provider clarification for this
specific use before connecting/importing; these notes are not a legal determination.
Do not silently repurpose Places API rules, remove attribution, or scrape instead.

## Exact owner actions to unblock

1. Confirm paid-pilot demand justifies this P2 integration, as required by #46.
2. Establish the developer's eligible GBP/website and Google Cloud project, request
   basic API access, confirm approval/quota, and enable the official APIs. Do not
   require each pilot business to apply for a supplemental developer project.
3. Ask Google to clarify permitted quote extraction/social reuse, attribution,
   cache/retention and handling of deleted/edited reviews for this product. Record
   the response and agreed policy before implementing persistence/publication.
4. Register an OAuth consent/client and canonical redirect, complete any required
   verification, and provide credentials through runtime secret configuration.
   Choose an owner-authorized verified test location and consented data scope.
5. Provide external encryption-key management and retention/deletion requirements;
   never place refresh tokens or encryption keys in source, test fixtures or logs.

## Implementation gate after access/policy resolution

Reuse #42 ownership, #43 durable queue and #45 identity; do not build parallel auth,
queue or deduplication systems. Add owner connect/location select/disconnect,
authenticated encryption with owner/business-bound associated data, a rotating-key
plan, and revoked/expired consent handling. Persist stable source IDs/checkpoints;
upsert pages transactionally, use bounded rate-limit retries, and retain last sync,
counts and sanitized error codes. Incremental refresh must account for edits and
periodic full reconciliation for deletions; absent pages during an interrupted scan
are not proof of deletion. Never silently mutate approved/published artifacts.

Fixture coverage must include pagination/repeated sync/edits/429/expired tokens,
interrupted import, ownership and disconnect. Live acceptance requires a permitted
location import followed by a duplicate-free refresh, with sanitized evidence.
A retention/deletion migration must preserve draft references while respecting the
resolved policy; do not blindly delete reviews. No connector, schema change, live
acceptance, production configuration or provider permission is claimed by this PR.
