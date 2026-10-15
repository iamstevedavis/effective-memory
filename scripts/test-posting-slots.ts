import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { databaseFixture } from "./db-fixture";
import { sessionHash } from "../lib/auth-adapter";
import { proposeSlots,defaultPostingSlots,localSlotInstant,validateSlots,assignSlots } from "../lib/services/postingSlots";
async function main(){
  assert.equal(localSlotInstant("2026-03-08","02:30","America/New_York"),"2026-03-08T07:00:00.000Z");
  assert.equal(localSlotInstant("2026-11-01","01:30","America/New_York"),"2026-11-01T05:30:00.000Z");
  assert.equal(localSlotInstant("2026-10-04","02:15","Australia/Lord_Howe"),"2026-10-03T15:30:00.000Z");
  const fixed=new Date("2026-10-18T23:00:00Z");
  const slots=proposeSlots("Pacific/Auckland",defaultPostingSlots,fixed,3);
  assert.equal(slots[0],"2026-10-19T21:00:00.000Z");
  assert.ok(!proposeSlots("Pacific/Auckland",defaultPostingSlots,fixed,3,[slots[0]]).includes(slots[0]));
  assert.equal(proposeSlots("UTC",[{weekday:0,time:"10:00"}],new Date("2026-10-18T11:00:00Z"),15).length,4);
  assert.throws(()=>validateSlots([{weekday:2,time:"25:00"}]));assert.throws(()=>validateSlots([{weekday:2,time:"10:00"},{weekday:2,time:"11:00"}]));
  assert.throws(()=>proposeSlots("invalid-zone",defaultPostingSlots,fixed));
  const root=mkdtempSync(join(tmpdir(),"slots-"));process.env.MEDIA_ROOT=root;process.env.NEXTAUTH_URL="http://localhost";
  writeFileSync(join(root,"fixture.png"),await sharp({create:{width:1080,height:1080,channels:3,background:"#123456"}}).png().toBuffer());
  try{await databaseFixture(async c=>{
    await c.query("INSERT INTO auth_users(id,email) VALUES('slot-owner','slots@example.invalid')");
    await c.query("INSERT INTO auth_sessions VALUES($1,'slot-owner',now()+interval '1 hour')",[sessionHash("slot-session")]);
    const bid=(await c.query("INSERT INTO businesses(name,timezone,owner_id) VALUES('Synthetic slots','UTC','slot-owner') RETURNING id")).rows[0].id;
    const draft=async(status="approved")=>Number((await c.query("INSERT INTO draft_posts(business_id,quote_text,caption_text,image_path,status) VALUES($1,'Synthetic','Synthetic','/api/media/fixture.png',$2) RETURNING id",[bid,status])).rows[0].id);
    const a=await draft(),b=await draft(),bad=await draft("failed"),future=proposeSlots("UTC",defaultPostingSlots,new Date(),5);
    assert.equal((await assignSlots("slot-owner",bid,[{draftPostId:a,version:0,instant:future[0]}]))[0].status,503);
    assert.equal((await c.query("SELECT count(*) FROM posting_slot_claims")).rows[0].count,"0");
    let calls=0;
    const submit=async()=>{calls++;return {provider:"buffer" as const,confirmed:true,status:"scheduled" as const,externalId:"synthetic-fixture-id"};};
    const raced=await Promise.all([assignSlots("slot-owner",bid,[{draftPostId:a,version:0,instant:future[0]}],submit),assignSlots("slot-owner",bid,[{draftPostId:b,version:0,instant:future[0]}],submit)]);
    assert.equal(raced.flat().filter(r=>r.status===200).length,1);assert.equal(calls,1);
    assert.equal((await assignSlots("foreign-owner",bid,[{draftPostId:bad,version:0,instant:future[1]}],submit))[0].status,404);
    assert.equal((await assignSlots("slot-owner",bid,[{draftPostId:bad,version:0,instant:future[1]}],submit))[0].status,409);
    const unknown=await draft();
    assert.equal((await assignSlots("slot-owner",bid,[{draftPostId:unknown,version:0,instant:future[1]}],async()=>{throw new Error("synthetic-private-provider-body");}))[0].status,502);
    assert.equal((await assignSlots("slot-owner",bid,[{draftPostId:unknown,version:0,instant:future[1]}],submit))[0].status,409);
    const edit=await require("../app/api/drafts/caption/route").POST(new NextRequest("http://localhost/api/drafts/caption",{method:"POST",headers:{cookie:"next-auth.session-token=slot-session",origin:"http://localhost","content-type":"application/json"},body:JSON.stringify({draftPostId:unknown,version:0,captionText:"Must not change"})}));assert.equal(edit.status,409);
    const db=require("../lib/db"),original=db.transaction,late=await draft();let accepted=false;
    db.transaction=(run:any)=>accepted?Promise.reject(new Error("synthetic-local-confirmation-failure")):original(run);
    try{assert.equal((await assignSlots("slot-owner",bid,[{draftPostId:late,version:0,instant:future[2]}],async()=>{accepted=true;return submit();}))[0].status,502);}finally{db.transaction=original;}
    assert.equal((await c.query("SELECT state FROM posting_slot_claims WHERE draft_id=$1",[late])).rows[0].state,"pending");
    assert.equal((await assignSlots("slot-owner",bid,[{draftPostId:late,version:0,instant:future[2]}],submit))[0].status,409,"accepted-but-uncommitted outcome cannot resubmit");
    const confirmed=(await c.query("SELECT scheduled_for FROM draft_posts WHERE status='scheduled'")).rows[0].scheduled_for;
    await c.query("UPDATE businesses SET timezone='America/New_York' WHERE id=$1",[bid]);
    assert.equal((await c.query("SELECT scheduled_for FROM draft_posts WHERE status='scheduled'")).rows[0].scheduled_for.toISOString(),confirmed.toISOString());
  });}finally{rmSync(root,{recursive:true,force:true});}
  console.log("posting slots DST/rollover/ownership/concurrency/ambiguous acceptance tests passed (provider fixtures only)");
}
main().catch(err=>{console.error(err);process.exitCode=1;});
