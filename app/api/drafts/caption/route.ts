import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const draftPostId = Number(body?.draftPostId);
  const captionText = String(body?.captionText ?? "").trim();

  if (!Number.isInteger(draftPostId) || draftPostId <= 0) {
    return NextResponse.json({ error: "valid draftPostId is required" }, { status: 400 });
  }

  if (!captionText) {
    return NextResponse.json({ error: "captionText is required" }, { status: 400 });
  }

  if (captionText.length > 200) {
    return NextResponse.json({ error: "captionText must be <= 200 chars" }, { status: 400 });
  }

  const result = await query<{ id: number; caption_text: string }>(
    `UPDATE draft_posts
     SET caption_text = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, caption_text`,
    [draftPostId, captionText]
  );

  if (!result.rowCount) {
    return NextResponse.json({ error: "draft post not found" }, { status: 404 });
  }

  return NextResponse.json({ draft: result.rows[0] });
}
