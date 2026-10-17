import { NextResponse } from "next/server";
import { ownerRoute } from "../../../lib/authorization";
import { query } from "../../../lib/db";
import { proposeSlots, validateSlots } from "../../../lib/services/postingSlots";
export const GET=ownerRoute(async req=>{
  const id=req.nextUrl.searchParams.get("businessId");
  const b=(await query("SELECT timezone,posting_slots FROM businesses WHERE id=$1",[id])).rows[0];
  const occupied=(await query("SELECT instant FROM posting_slot_claims WHERE business_id=$1 UNION SELECT scheduled_for AS instant FROM draft_posts WHERE business_id=$1 AND scheduled_for IS NOT NULL",[id])).rows.map(r=>new Date(r.instant).toISOString());
  return NextResponse.json({timezone:b.timezone,settings:b.posting_slots,slots:proposeSlots(b.timezone,b.posting_slots,new Date(),5,occupied)});
});
export const PATCH=ownerRoute(async req=>{
  const body=await req.json();let settings;
  try{settings=validateSlots(body.settings);}catch{return NextResponse.json({error:"Choose valid weekdays/local times"},{status:400});}
  await query("UPDATE businesses SET posting_slots=$2::jsonb WHERE id=$1",[body.businessId,JSON.stringify(settings)]);
  return NextResponse.json({settings});
});
