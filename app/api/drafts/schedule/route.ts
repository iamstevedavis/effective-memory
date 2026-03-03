import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const draftPostId = Number(body?.draftPostId);
  const scheduledFor = String(body?.scheduledFor ?? "").trim();

  if (!Number.isInteger(draftPostId) || draftPostId <= 0) {
    return NextResponse.json({ error: "valid draftPostId is required" }, { status: 400 });
  }

  const when = new Date(scheduledFor);
  if (!scheduledFor || Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: "valid scheduledFor datetime is required" }, { status: 400 });
  }

  const result = await query<{
    id: number;
    status: string;
    scheduled_for: string;
  }>(
    `UPDATE draft_posts
     SET scheduled_for = $2,
         status = CASE WHEN status = 'approved' THEN 'approved' ELSE status END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, status, scheduled_for::text`,
    [draftPostId, when.toISOString()]
  );

  if (!result.rowCount) {
    return NextResponse.json({ error: "draft post not found" }, { status: 404 });
  }

  return NextResponse.json({ draft: result.rows[0] });
}
