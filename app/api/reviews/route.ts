import { ownerRoute } from "../../../lib/authorization";
import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { PROFANITY } from "../../../lib/services/quoteSelector";

async function handleGET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  // Mirrors the quote selector's exclusions so owners can see why a review is or isn't used:
  // a draft on the review or any of its duplicates uses it up, and blocked words rule it out.
  const statusSql = `CASE WHEN r.duplicate_of IS NOT NULL THEN 'duplicate'
      WHEN EXISTS (SELECT 1 FROM draft_posts d WHERE d.review_id = r.id
        OR d.review_id IN (SELECT id FROM reviews WHERE duplicate_of = r.id)) THEN 'used'
      WHEN r.rating < 4 THEN 'low_rating'
      WHEN length(btrim(regexp_replace(r.text, '\\s+', ' ', 'g'))) < 30 THEN 'too_short'
      WHEN lower(r.text) ~ '${PROFANITY.join("|")}' THEN 'unsuitable'
      ELSE 'ready' END`;
  const result = await query<{
    id: number;
    rating: number;
    author_name: string | null;
    text: string;
    reviewed_at: string;
    source: string;
    status: string;
  }>(
    `SELECT r.id, r.rating, r.author_name, r.text, r.reviewed_at::text, r.source, ${statusSql} AS status
     FROM reviews r
     WHERE r.business_id = $1
     ORDER BY r.reviewed_at DESC, r.id DESC
     LIMIT 100`,
    [Number(businessId)]
  );
  const counts = await query<{ status: string; count: string }>(
    `SELECT ${statusSql} AS status, count(*)::text AS count FROM reviews r WHERE r.business_id = $1 GROUP BY 1`,
    [Number(businessId)]
  );

  return NextResponse.json({ reviews: result.rows, counts: Object.fromEntries(counts.rows.map(r => [r.status, Number(r.count)])) });
}

export const GET = ownerRoute(handleGET);
