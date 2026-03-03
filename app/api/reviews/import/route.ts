import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../lib/db";
import { parseCsv } from "../../../../lib/csv";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const businessIdRaw = String(formData.get("businessId") ?? "").trim();
  const file = formData.get("file");

  const businessId = Number(businessIdRaw);
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return NextResponse.json({ error: "valid businessId is required" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const csvText = await file.text();
  let rows;
  try {
    rows = parseCsv(csvText);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid CSV" },
      { status: 400 }
    );
  }

  let imported = 0;
  let skippedEmpty = 0;
  let rejectedInvalid = 0;

  for (const row of rows) {
    const ratingText = row.rating.trim();
    const text = row.text.trim();
    const reviewedAt = row.reviewed_at.trim();
    const authorName = row.author_name?.trim() || null;

    if (!ratingText && !text && !reviewedAt && !authorName) {
      skippedEmpty += 1;
      continue;
    }

    if (!ratingText || !text) {
      rejectedInvalid += 1;
      continue;
    }

    const rating = Number(ratingText);
    const date = new Date(reviewedAt);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5 || Number.isNaN(date.getTime())) {
      rejectedInvalid += 1;
      continue;
    }

    await query(
      `INSERT INTO reviews
      (business_id, source, source_review_id, rating, author_name, text, reviewed_at)
      VALUES ($1, 'manual', NULL, $2, $3, $4, $5)`,
      [businessId, Math.round(rating), authorName, text, date.toISOString()]
    );
    imported += 1;
  }

  return NextResponse.json({ imported, skippedEmpty, rejectedInvalid });
}
