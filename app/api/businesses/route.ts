import { NextRequest, NextResponse } from "next/server";
import { parseBrandColors, parseLogoUrl, type BrandTone } from "../../../lib/branding";
import { query } from "../../../lib/db";

function normalizeBrandTone(input: unknown): BrandTone {
  const tone = String(input ?? "friendly").trim().toLowerCase();
  if (tone === "premium" || tone === "playful") return tone;
  return "friendly";
}

export async function GET() {
  const result = await query<{
    id: number;
    name: string;
    timezone: string;
    brand_colors: Record<string, string> | null;
    logo_url: string | null;
    brand_tone: BrandTone;
  }>(
    `SELECT id, name, timezone, brand_colors, logo_url, brand_tone
     FROM businesses
     ORDER BY id ASC`
  );

  const businesses = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    timezone: row.timezone,
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

  const parsedBrandColors =
    body?.brandColors !== undefined
      ? parseBrandColors(body.brandColors)
      : parseBrandColors({
          primary: body?.primaryColor,
          secondary: body?.secondaryColor
        });

  const brandColors = {
    primary: parsedBrandColors.primary ?? "#1f2937",
    secondary: parsedBrandColors.secondary ?? "#374151"
  };

  const logoUrl = parseLogoUrl(body?.logoUrl);
  const brandTone = normalizeBrandTone(body?.brandTone);

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const result = await query<{
    id: number;
    name: string;
    timezone: string;
    brand_colors: Record<string, string> | null;
    logo_url: string | null;
    brand_tone: BrandTone;
  }>(
    `INSERT INTO businesses (name, timezone, brand_colors, logo_url, brand_tone)
     VALUES ($1, $2, $3::jsonb, $4, $5)
     RETURNING id, name, timezone, brand_colors, logo_url, brand_tone`,
    [name, timezone, JSON.stringify(brandColors), logoUrl, brandTone]
  );

  return NextResponse.json({ business: result.rows[0] }, { status: 201 });
}
