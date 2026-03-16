import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../lib/db";

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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return NextResponse.json({ error: "valid business id is required" }, { status: 400 });
  }

  const body = await req.json();
  const logoUrl = String(body?.logoUrl ?? "").trim() || null;
  const primaryColor = normalizeHex(body?.primaryColor);
  const secondaryColor = normalizeHex(body?.secondaryColor);
  const brandTone = normalizeBrandTone(body?.brandTone);

  if (!primaryColor || !secondaryColor) {
    return NextResponse.json(
      { error: "primaryColor and secondaryColor must be valid 6-digit hex colors" },
      { status: 400 }
    );
  }

  const result = await query<{
    id: number;
    name: string;
    logo_url: string | null;
    brand_tone: BrandTone;
    brand_colors: { primary?: string; secondary?: string };
  }>(
    `UPDATE businesses
     SET logo_url = $2,
         brand_colors = $3::jsonb,
         brand_tone = $4
     WHERE id = $1
     RETURNING id, name, logo_url, brand_tone, brand_colors`,
    [
      businessId,
      logoUrl,
      JSON.stringify({ primary: primaryColor, secondary: secondaryColor }),
      brandTone
    ]
  );

  if (!result.rowCount) {
    return NextResponse.json({ error: "business not found" }, { status: 404 });
  }

  return NextResponse.json({ business: result.rows[0] });
}
