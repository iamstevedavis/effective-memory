import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../lib/db";
import { renderDraftImage } from "../../../../lib/services/imageRenderer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const draftPostId = Number(body?.draftPostId);

    if (!Number.isInteger(draftPostId) || draftPostId <= 0) {
      return NextResponse.json({ error: "valid draftPostId is required" }, { status: 400 });
    }

    const draft = await query<{
      id: number;
      quote_text: string;
      business_name: string;
      brand_colors: Record<string, string> | null;
      logo_url: string | null;
    }>(
      `SELECT d.id, d.quote_text, b.name AS business_name, b.brand_colors, b.logo_url
       FROM draft_posts d
       JOIN businesses b ON b.id = d.business_id
       WHERE d.id = $1
       LIMIT 1`,
      [draftPostId]
    );

    if (!draft.rowCount) {
      return NextResponse.json({ error: "draft not found" }, { status: 404 });
    }

    const row = draft.rows[0];
    const brandHex = row.brand_colors?.primary ?? null;

    const rendered = await renderDraftImage({
      draftPostId,
      businessName: row.business_name,
      quoteText: row.quote_text,
      brandHex,
      logoUrl: row.logo_url
    });

    const updated = await query<{ id: number; image_path: string }>(
      `UPDATE draft_posts
       SET image_path = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, image_path`,
      [draftPostId, rendered.publicPath]
    );

    return NextResponse.json({ draft: updated.rows[0] });
  } catch (err) {
    console.error("image_render_failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "render failed" }, { status: 500 });
  }
}
