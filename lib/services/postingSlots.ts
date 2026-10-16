import { validTimezone } from "../timezone";
export { validTimezone } from "../timezone";
import { transaction } from "../db";
import { availableImage } from "./draftLifecycle";
import { scheduleApprovedDraft, SchedulerUnavailable, type SchedulePayload, type ScheduleReceipt } from "../integrations/scheduler";
export type PostingSlot={weekday:number;time:string};
export const defaultPostingSlots:PostingSlot[]=[2,4,6].map(weekday=>({weekday,time:"10:00"}));
export function validateSlots(value:unknown):PostingSlot[]{
  if(!Array.isArray(value)||!value.length||value.length>7||value.some(s=>!s||!Number.isInteger(s.weekday)||s.weekday<0||s.weekday>6||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time))||new Set(value.map(s=>s.weekday)).size!==value.length)throw new Error("Choose 1–7 unique weekdays and valid HH:mm times");
  return value.map(s=>({weekday:s.weekday,time:s.time}));
}
function formatter(zone:string){return new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});}
function localEpoch(date:Date,fmt:Intl.DateTimeFormat){const p=fmt.formatToParts(date);const v=(k:string)=>Number(p.find(x=>x.type===k)!.value);return Date.UTC(v("year"),v("month")-1,v("day"),v("hour"),v("minute"));}
export function localSlotInstant(day:string,time:string,zone:string){
  const fmt=formatter(zone),target=Date.parse(`${day}T${time}:00Z`);
  const offsets=new Set([-36,-24,-12,0,12,24,36].map(h=>{const t=target+h*3600000;return localEpoch(new Date(t),fmt)-t;}));
  // Nonexistent local minutes move to the next valid minute; repeated minutes use earliest UTC.
  for(let forward=0;forward<=1440;forward++){
    const wanted=target+forward*60000;
    const matches=[...offsets].map(offset=>wanted-offset).filter(t=>localEpoch(new Date(t),fmt)===wanted);
    if(matches.length)return new Date(Math.min(...matches)).toISOString();
  }
  throw new Error("No supported local slot in this timezone");
}
export function proposeSlots(zone:string,settings:PostingSlot[],now=new Date(),count=5,occupied:string[]=[]){
  validateSlots(settings);if(!validTimezone(zone)||!Number.isInteger(count)||count<1||count>15)throw new Error("Invalid timezone or slot count");
  const local=new Date(localEpoch(now,formatter(zone)));local.setUTCHours(0,0,0,0);const results:string[]=[];
  for(let day=0;day<35&&results.length<count;day++){
    const date=new Date(local.getTime()+day*86400000),slot=settings.find(s=>s.weekday===date.getUTCDay());if(!slot)continue;
    const instant=localSlotInstant(date.toISOString().slice(0,10),slot.time,zone);
    if(Date.parse(instant)>now.getTime()&&!occupied.includes(instant)&&!results.includes(instant))results.push(instant);
  }
  return results;
}
export async function assignSlots(owner:string,businessId:number,items:{draftPostId:number;version:number;instant:string}[],submit:(p:SchedulePayload)=>Promise<ScheduleReceipt>=scheduleApprovedDraft){
  const results=[];
  for(const item of items){
    results.push(await transaction(async c=>{
      const fail=(error:string,status=409)=>({draftPostId:item.draftPostId,status,error});
      const b=(await c.query("SELECT * FROM businesses WHERE id=$1 AND owner_id=$2 FOR UPDATE",[businessId,owner])).rows[0];if(!b)return fail("Business not found",404);
      const d=(await c.query("SELECT * FROM draft_posts WHERE id=$1 AND business_id=$2 FOR UPDATE",[item.draftPostId,businessId])).rows[0];if(!d)return fail("Draft not found",404);
      if(d.version!==item.version||d.status!=="approved"||!d.caption_text.trim()||!await availableImage(d.image_path))return fail("Only current complete approved drafts can be assigned");
      const instant=new Date(item.instant);if(!Number.isFinite(instant.getTime())||instant.getTime()<=Date.now())return fail("Choose a future UTC slot",400);
      const occupied=(await c.query("SELECT instant::text FROM posting_slot_claims WHERE business_id=$1 UNION SELECT scheduled_for::text FROM draft_posts WHERE business_id=$1 AND scheduled_for IS NOT NULL",[businessId])).rows.map(r=>new Date(r.instant).toISOString());
      if(!proposeSlots(b.timezone,b.posting_slots,new Date(),15,occupied).includes(instant.toISOString()))return fail("Slot is occupied or no longer in the proposed schedule");
      const claim=await c.query("INSERT INTO posting_slot_claims(business_id,instant,draft_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING draft_id",[businessId,instant,item.draftPostId]);if(!claim.rowCount)return fail("Slot or draft is already assigned");
      return {payload:{draftPostId:d.id,businessId,quoteText:d.quote_text,captionText:d.caption_text,imagePath:d.image_path,scheduledFor:instant.toISOString()} as SchedulePayload};
    }).then(async reserved=>{
      if(!("payload" in reserved))return reserved;
      const payload=reserved.payload;
      const fail=(error:string,status=502)=>({draftPostId:item.draftPostId,status,error});
      // Claim is committed BEFORE the remote call. A crash/local write failure cannot erase ambiguity.
      let receipt:ScheduleReceipt;
      try{receipt=await submit(payload);}
      catch(e){if(e instanceof SchedulerUnavailable){await transaction(c=>c.query("DELETE FROM posting_slot_claims WHERE draft_id=$1 AND state='pending'",[item.draftPostId]));return fail("Buffer connection not configured/verified; no post submitted",503);}
        await transaction(c=>c.query("UPDATE posting_slot_claims SET state='unknown' WHERE draft_id=$1",[item.draftPostId])).catch(()=>{});return fail("Provider outcome unknown; resolve before retrying");}
      if(receipt.provider!=="buffer"||!receipt.confirmed||receipt.status!=="scheduled"||!receipt.externalId){await transaction(c=>c.query("UPDATE posting_slot_claims SET state='unknown' WHERE draft_id=$1",[item.draftPostId]));return fail("No verified provider acceptance; inspect before retrying");}
      try{return await transaction(async c=>{
        await c.query("SELECT set_config('app.actor_id',$1,true),set_config('app.action','assign_slot',true),set_config('app.reason','provider_confirmed',true)",[owner]);
        const claimed=await c.query("UPDATE posting_slot_claims SET state='confirmed',external_id=$2 WHERE draft_id=$1 AND state='pending'",[item.draftPostId,receipt.externalId]);
        if(!claimed.rowCount)throw new Error("Claim changed");
        const updated=await c.query("UPDATE draft_posts SET status='scheduled',scheduled_for=$2,updated_at=now() WHERE id=$1 AND version=$3 AND status='approved'",[item.draftPostId,payload.scheduledFor,item.version]);
        if(!updated.rowCount)throw new Error("Draft changed");
        return {draftPostId:item.draftPostId,status:200,instant:payload.scheduledFor,providerConfirmed:true};
      });}catch{return fail("Provider accepted; local confirmation pending. Resolve before retrying");}
    }));
  }
  return results;
}
