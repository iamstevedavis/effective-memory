import { NextRequest, NextResponse } from "next/server";
import { selectQuoteCandidates } from "../../../../lib/services/quoteSelector";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const businessId = Number(body?.businessId);
  const limit = Number(body?.limit ?? 5);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return NextResponse.json({ error: "valid businessId is required" }, { status: 400 });
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 25) {
    return NextResponse.json({ error: "limit must be an integer between 1 and 25" }, { status: 400 });
  }

  const candidates = await selectQuoteCandidates(businessId, limit);
  return NextResponse.json({ inserted: candidates.length, candidates });
}
