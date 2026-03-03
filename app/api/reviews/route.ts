import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../lib/db";

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  const result = await query<{
    id: number;
    rating: number;
    author_name: string | null;
    text: string;
    reviewed_at: string;
  }>(
    `SELECT id, rating, author_name, text, reviewed_at::text
     FROM reviews
     WHERE business_id = $1
     ORDER BY reviewed_at DESC, id DESC
     LIMIT 100`,
    [Number(businessId)]
  );

  return NextResponse.json({ reviews: result.rows });
}
