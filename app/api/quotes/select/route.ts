import { ownerRoute } from "../../../../lib/authorization";
import { NextRequest, NextResponse } from "next/server";
import { requestGeneration } from "../../../../lib/services/generation";

async function handlePOST(req: NextRequest) {
  const body = await req.json();
  const businessId = Number(body?.businessId);
  const limit = Number(body?.limit ?? 3);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return NextResponse.json({ error: "valid businessId is required" }, { status: 400 });
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 5) {
    return NextResponse.json({ error: "limit must be an integer between 1 and 5" }, { status: 400 });
  }

  const result = await requestGeneration(businessId, limit);
  return NextResponse.json({ ...result, candidates: [], message: "Generation queued; monitor job status" }, { status: 202 });
}

export const POST = ownerRoute(handlePOST);
