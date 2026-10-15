import { NextRequest, NextResponse } from "next/server";
import { ownerRoute } from "../../../../lib/authorization";
import { POST as approve } from "../status/route";
export const POST=ownerRoute(async req=>{
  const body=await req.json();
  if(!Array.isArray(body.items)||!body.items.length||body.items.length>20||body.items.some((i: {draftPostId?: unknown;version?: number})=>!i||!Number.isSafeInteger(Number(i.draftPostId))||Number(i.draftPostId)<=0||!Number.isInteger(i.version)))return NextResponse.json({error:"Choose 1–20 drafts"},{status:400});
  const results=[];
  for(const item of body.items){
    const response=await approve(new NextRequest(new URL("/api/drafts/status",req.url),{method:"POST",headers:req.headers,body:JSON.stringify({draftPostId:item.draftPostId,version:item.version,status:"approved"})}));
    const result=await response.json();results.push({draftPostId:item.draftPostId,status:response.status,error:result.error});
  }
  return NextResponse.json({results});
});
