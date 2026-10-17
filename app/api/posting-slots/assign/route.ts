import { NextResponse } from "next/server";
import { ownerRoute, currentOwner } from "../../../../lib/authorization";
import { assignSlots } from "../../../../lib/services/postingSlots";
export const POST=ownerRoute(async req=>{
  const body=await req.json();
  if(body.confirm!==true||!Array.isArray(body.items)||!body.items.length||body.items.length>5||body.items.some((i:any)=>!i||!Number.isSafeInteger(Number(i.draftPostId))||!Number.isInteger(i.version)||typeof i.instant!=="string"))return NextResponse.json({error:"Explicitly confirm 1–5 current approved drafts and UTC slots"},{status:400});
  return NextResponse.json({results:await assignSlots(currentOwner(),Number(body.businessId),body.items)});
});
