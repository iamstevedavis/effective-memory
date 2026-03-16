import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../lib/db";

type BrandTone = "friendly" | "premium" | "playful";

function normalizeHex(input: unknown): string | null {
  const value = String(input ?? "").trim();
  if (!value) return null;
  if (!/^#?[0-9a-fA-F]{6}$/.test(value)) return null;
  return value.startsWith("#") ? value.toLowerCase() : `#${value.toLowerCase()}`;
}

function normalizeBrandTone(input: unknown): BrandTone {
  const tone = String(input ?? "friendly").trim().toLowerCase();
  if (tone === "premium" || tone === "playful") return tone;
  return "friendly";
}

export async function GET() {
  const result = await query<{
    id: number;
    name: string;
    logo_url: string | null;
    brand_tone: BrandTone;
    brand_colors: { primary?: string; secondary?: string } | null;
  }>(
    "SELECT id, name, logo_url, brand_tone, brand_colors FROM businesses ORDER BY id ASC"
  );

  const businesses = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    logo_url: row.logo_url,
    brand_tone: row.brand_tone,
    brand_colors: {
      primary: row.brand_colors?.primary ?? "#1f2937",
      secondary: row.brand_colors?.secondary ?? "#374151"
    }
  }));

  return NextResponse.json({ businesses });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  const timezone = String(body?.timezone ?? "America/Toronto").trim();
  const logoUrl = String(body?.logoUrl ?? "").trim() || null;
  const primaryColor = normalizeHex(body?.primaryColor) ?? "#1f2937";
  const secondaryColor = normalizeHex(body?.secondaryColor) ?? "#374151";
  const brandTone = normalizeBrandTone(body?.brandTone);

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const result = await query<{
    id: number;
    name: string;
    logo_url: string | null;
    brand_tone: BrandTone;
    brand_colors: { primary?: string; secondary?: string };
  }>(
    `INSERT INTO businesses (name, timezone, brand_colors, logo_url, brand_tone)
     VALUES ($1, $2, $3::jsonb, $4, $5)
     RETURNING id, name, logo_url, brand_tone, brand_colors`,
    [
      name,
      timezone,
      JSON.stringify({ primary: primaryColor, secondary: secondaryColor }),
      logoUrl,
      brandTone
    ]
  );

  return NextResponse.json({ business: result.rows[0] }, { status: 201 });
}
