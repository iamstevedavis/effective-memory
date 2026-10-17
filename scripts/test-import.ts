import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { selectQuoteCandidates } from "../lib/services/quoteSelector";
const boundary = require("../lib/authorization");
boundary.ownerRoute = (handler: unknown) => handler;
boundary.currentOwner = () => "synthetic-owner";
const { POST } = require("../app/api/reviews/import/route");
const { GET: listReviews } = require("../app/api/reviews/route");
import { parseCsv } from "../lib/csv";
import { databaseFixture } from "./db-fixture";
async function main() {
  assert.equal(parseCsv('rating,text,reviewed_at\n5,"Line one\nLine two",2026-10-01')[0].text, "Line one\nLine two");
  assert.throws(() => parseCsv('rating,text,reviewed_at\n5,"open,2026-10-01'));
  assert.throws(() => parseCsv('rating,text,reviewed_at\n' + '5,hi,2026-10-01\n'.repeat(1001)));
  await databaseFixture(async client => {
    const bid = (await client.query("SELECT id FROM businesses LIMIT 1")).rows[0].id;
    const migrated = await client.query("SELECT id,duplicate_of FROM reviews ORDER BY id");
    assert.equal(migrated.rows.length, 2); assert.equal(String(migrated.rows[1].duplicate_of), String(migrated.rows[0].id));
    assert.equal((await client.query("SELECT review_id FROM draft_posts LIMIT 1")).rows[0].review_id, migrated.rows[1].id);
    const upload = (csv: string, id = bid) => {
      const form = new FormData(); form.set("businessId", String(id)); form.set("file", new File([csv], "synthetic.csv"));
      return POST(new NextRequest("http://localhost/api/reviews/import", { method: "POST", body: form }));
    };
    assert.deepEqual(await selectQuoteCandidates(bid), [], "a draft on a legacy duplicate excludes the canonical review");
    const enriched = await (await upload('rating,text,reviewed_at,source_url\n5,Existing synthetic review with friendly staff,2026-10-01,https://example.com/retained')).json();
    assert.deepEqual([enriched.imported, enriched.duplicates], [0, 1]);
    const canonical = (await client.query("SELECT text,source_url FROM reviews WHERE duplicate_of IS NULL")).rows[0];
    assert.equal(canonical.source_url, "https://example.com/retained");
    await upload('rating,text,reviewed_at,source_url\n5,Existing synthetic review with friendly staff,2026-10-01,https://example.com/replaced');
    assert.equal((await client.query("SELECT source_url FROM reviews WHERE duplicate_of IS NULL")).rows[0].source_url, canonical.source_url);
    const csv = 'rating,text,reviewed_at,author_name,source_review_id,source_url\n5,"A synthetic welcome",2026-10-01,Example,,https://example.com/review\n5,"  a  synthetic WELCOME  ",2026-10-01,example,,\n4.5,invalid,2026-10-01,,,\n5,invalid,2026-02-30,,,\n,,,,,\n';
    const first = await (await upload(csv)).json();
    assert.deepEqual([first.imported, first.duplicates, first.rejectedInvalid, first.skippedEmpty], [1, 1, 2, 1]);
    const results = await Promise.all([upload(csv), upload(csv)]);
    for (const result of results) { const body = await result.json(); assert.equal(body.imported, 0); assert.equal(body.duplicates, 2); }
    assert.equal((await client.query("SELECT count(*) FROM reviews")).rows[0].count, "3");
    const db = require("../lib/db"), original = db.query;
    db.query = (sql: string, params: unknown[]) => params?.[3] === "Synthetic storage failure" ? Promise.reject(new Error("synthetic")) : original(sql, params);
    try {
      const partial = await (await upload('rating,text,reviewed_at\n5,Synthetic storage failure,2026-10-01\n5,Synthetic stored row,2026-10-01')).json();
      assert.equal(partial.failedRows, 1); assert.equal(partial.imported, 1);
    } finally { db.query = original; }
    const fresh = 'rating,text,reviewed_at,source_review_id\n5,Concurrent synthetic,2026-10-01,new-id';
    const concurrent = await Promise.all([upload(fresh), upload(fresh)]);
    assert.equal((await Promise.all(concurrent.map(r => r.json()))).reduce((n, r) => n + r.imported, 0), 1);
    assert.equal((await upload("x".repeat(1000001))).status, 413);
    const keys = await client.query("SELECT review_identity(NULL,5,'EXAMPLE','Ａ  welcome','2026-10-01') = review_identity(NULL,5,'example','a welcome','2026-10-01') same");
    assert.equal(keys.rows[0].same, true);
    assert.equal((await upload(csv, 999999)).status, 404);
    const second = (await client.query("INSERT INTO businesses(name,timezone) VALUES('Other synthetic','UTC') RETURNING id")).rows[0].id;
    assert.equal((await (await upload(csv, second)).json()).imported, 1);
    const stable = 'rating,text,reviewed_at,source_review_id\n5,Original text,2026-10-01,source-1\n5,Changed text,2026-10-02,source-1';
    assert.deepEqual([(await (await upload(stable)).json()).duplicates], [1]);
    const listed = (await client.query("INSERT INTO businesses(name,timezone) VALUES('Synthetic status fixture','UTC') RETURNING id")).rows[0].id;
    const rows = await client.query(`INSERT INTO reviews(business_id,source,source_review_id,rating,text,reviewed_at) VALUES
      ($1,'manual','ready',5,'A lovely synthetic visit with friendly staff','2026-10-01'),($1,'manual','used',5,'Another lovely synthetic visit with friendly staff','2026-10-02'),
      ($1,'manual','low',3,'An average synthetic visit with slow staff today','2026-10-03'),($1,'manual','short',5,'So   good!!','2026-10-04'),
      ($1,'manual','rude',5,'The SHITtiest parking but a lovely synthetic visit','2026-10-05'),($1,'manual','canon',5,'A canonical synthetic review with friendly staff','2026-10-06') RETURNING id`, [listed]);
    const child = (await client.query("INSERT INTO reviews(business_id,source,source_review_id,rating,text,reviewed_at,duplicate_of) VALUES($1,'manual','child',5,'A canonical synthetic review with friendly staff','2026-10-06',$2) RETURNING id", [listed, rows.rows[5].id])).rows[0].id;
    await client.query("INSERT INTO draft_posts(business_id,review_id,quote_text,caption_text) VALUES($1,$2,'Synthetic','Synthetic')", [listed, child]);
    await client.query("INSERT INTO draft_posts(business_id,review_id,quote_text,caption_text) VALUES($1,$2,'Synthetic','Synthetic')", [listed, rows.rows[1].id]);
    const listing = await (await listReviews(new NextRequest(`http://localhost/api/reviews?businessId=${listed}`))).json();
    assert.deepEqual(listing.reviews.map((r: { status: string }) => r.status), ["duplicate", "used", "unsuitable", "too_short", "low_rating", "used", "ready"], "review status mirrors quote eligibility");
    assert.deepEqual(listing.counts, { ready: 1, used: 2, low_rating: 1, too_short: 1, unsuitable: 1, duplicate: 1 });
  }, async (name, client) => {
    if (name !== "006_review_identity.sql") return;
    const id = (await client.query("INSERT INTO businesses(name,timezone) VALUES('Synthetic duplicate fixture','UTC') RETURNING id")).rows[0].id;
    const reviews = await client.query("INSERT INTO reviews(business_id,source,rating,text,reviewed_at) VALUES($1,'manual',5,'Existing synthetic review with friendly staff','2026-10-01'),($1,'manual',5,'Existing synthetic review with friendly staff','2026-10-01') RETURNING id", [id]);
    await client.query("INSERT INTO draft_posts(business_id,review_id,quote_text,caption_text) VALUES($1,$2,'Synthetic','Synthetic')", [id, reviews.rows[1].id]);
  });
  console.log("CSV normalization/migration/concurrent import/review status tests passed");
}
main().catch(err => { console.error(err); process.exitCode = 1; });
