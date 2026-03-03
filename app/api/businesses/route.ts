import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../lib/db";

export async function GET() {
  const result = await query<{ id: number; name: string }>(
    "SELECT id, name FROM businesses ORDER BY id ASC"
  );
  return NextResponse.json({ businesses: result.rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  const timezone = String(body?.timezone ?? "America/Toronto").trim();

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const result = await query<{ id: number; name: string }>(
    `INSERT INTO businesses (name, timezone, brand_colors)
     VALUES ($1, $2, '{}'::jsonb)
     RETURNING id, name`,
    [name, timezone]
  );

  return NextResponse.json({ business: result.rows[0] }, { status: 201 });
}
