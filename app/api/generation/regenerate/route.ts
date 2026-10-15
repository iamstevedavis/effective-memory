import { NextResponse } from "next/server";
import { ownerRoute } from "../../../../lib/authorization";
import { draftMutation, regenerateDraft } from "../../../../lib/services/draftLifecycle";
export const POST=ownerRoute(draftMutation("regenerate",async req=>{
  const body=await req.json(), queued=await regenerateDraft(Number(body.draftPostId));
  return NextResponse.json({queued,message:queued?"Regeneration queued; approval cleared":"Generation retry budget exhausted or no recoverable job"},{status:queued?202:409});
}));
