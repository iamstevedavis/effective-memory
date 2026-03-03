import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../lib/db";

export async function GET(req: NextRequest) {
  const businessId = Number(req.nextUrl.searchParams.get("businessId"));
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return NextResponse.json({ error: "valid businessId is required" }, { status: 400 });
  }

  const result = await query<{
    id: number;
    review_id: number | null;
    quote_text: string;
    caption_text: string;
    image_path: string | null;
    status: string;
    audit_note: string | null;
    scheduled_for: string | null;
    created_at: string;
  }>(
    `SELECT id, review_id, quote_text, caption_text, image_path, status, audit_note, scheduled_for::text, created_at::text
     FROM draft_posts
     WHERE business_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 100`,
    [businessId]
  );

  return NextResponse.json({ drafts: result.rows });
}
