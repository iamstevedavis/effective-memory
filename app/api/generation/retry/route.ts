import { NextResponse } from "next/server";
import { ownerRoute } from "../../../../lib/authorization";
import { retryGeneration } from "../../../../lib/services/generation";
export const POST = ownerRoute(async req => {
  const body = await req.json();
  const retried = await retryGeneration(Number(body.draftPostId));
  return NextResponse.json({ retried, message: retried ? "Retry queued" : "Only exhausted failed jobs can be retried (two manual retries maximum)" }, {status:retried ? 202 : 409});
});
