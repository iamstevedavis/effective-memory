import { NextRequest, NextResponse } from "next/server";
import { parseBrandColors, parseLogoUrl, type BrandTone } from "../../../../lib/branding";
import { query } from "../../../../lib/db";

type BusinessRow = {
  id: number;
  name: string;
  timezone: string;
  brand_colors: Record<string, string> | null;
  logo_url: string | null;
  brand_tone: BrandTone;
};

function normalizeBrandTone(input: unknown): BrandTone {
  const tone = String(input ?? "friendly").trim().toLowerCase();
  if (tone === "premium" || tone === "playful") return tone;
  return "friendly";
}

function normalizeHex(input: unknown): string | null {
  const value = String(input ?? "").trim();
  if (!value) return null;
  if (!/^#?[0-9a-fA-F]{6}$/.test(value)) return null;
  return value.startsWith("#") ? value.toLowerCase() : `#${value.toLowerCase()}`;
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const businessId = Number(params.id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return NextResponse.json({ error: "valid business id is required" }, { status: 400 });
  }

  const body = await req.json();

  const hasLegacyColorFields = body?.primaryColor !== undefined || body?.secondaryColor !== undefined;
  const hasExtendedFields =
    body?.name !== undefined || body?.timezone !== undefined || body?.brandColors !== undefined;

  if (hasLegacyColorFields && !hasExtendedFields) {
    const primaryColor = normalizeHex(body?.primaryColor);
    const secondaryColor = normalizeHex(body?.secondaryColor);
    if (!primaryColor || !secondaryColor) {
      return NextResponse.json(
        { error: "primaryColor and secondaryColor must be valid 6-digit hex colors" },
        { status: 400 }
      );
    }

    const logoUrl = parseLogoUrl(body?.logoUrl);
    const brandTone = normalizeBrandTone(body?.brandTone);

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

  const existing = await query<BusinessRow>(
    `SELECT id, name, timezone, brand_colors, logo_url, brand_tone
     FROM businesses
     WHERE id = $1
     LIMIT 1`,
    [businessId]
  );

  if (!existing.rowCount) {
    return NextResponse.json({ error: "business not found" }, { status: 404 });
  }

  const current = existing.rows[0];

  const name = body?.name === undefined ? current.name : String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
  }

  const timezone =
    body?.timezone === undefined
      ? current.timezone
      : String(body.timezone ?? "").trim() || current.timezone;

  let brandColors: Record<string, string> = current.brand_colors ?? {};
  if (body?.brandColors !== undefined) {
    brandColors = parseBrandColors(body.brandColors);
  }

  const logoRaw = body?.logoUrl === undefined ? current.logo_url : body.logoUrl;
  const logoUrl = parseLogoUrl(logoRaw);

  const toneCandidate =
    body?.brandTone === undefined ? current.brand_tone : normalizeBrandTone(body.brandTone);

  const updated = await query<BusinessRow>(
    `UPDATE businesses
     SET name = $2,
         timezone = $3,
         brand_colors = $4::jsonb,
         logo_url = $5,
         brand_tone = $6
     WHERE id = $1
     RETURNING id, name, timezone, brand_colors, logo_url, brand_tone`,
    [businessId, name, timezone, JSON.stringify(brandColors), logoUrl, toneCandidate]
  );

  return NextResponse.json({ business: updated.rows[0] });
}
