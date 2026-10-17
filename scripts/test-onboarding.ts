import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { databaseFixture } from "./db-fixture";
import { sessionHash } from "../lib/auth-adapter";
async function main(){
  process.env.NEXTAUTH_URL="http://localhost";
  await databaseFixture(async c=>{
    await c.query("INSERT INTO auth_users(id,email) VALUES('onboard-a','onboard-a@example.invalid'),('onboard-b','onboard-b@example.invalid')");
    await c.query("INSERT INTO auth_sessions VALUES($1,'onboard-a',now()+interval '1 hour'),($2,'onboard-b',now()+interval '1 hour')",[sessionHash("onboard-session-a"),sessionHash("onboard-session-b")]);
    const request=(path:string,method="GET",body?:unknown,token="onboard-session-a")=>new NextRequest(`http://localhost/api/${path}`,{method,headers:{cookie:`next-auth.session-token=${token}`,origin:"http://localhost","content-type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const businesses=require("../app/api/businesses/route"),onboarding=require("../app/api/onboarding/route");
    assert.equal((await (await onboarding.GET(request("onboarding"))).json()).business,null);
    const body={name:"Synthetic onboarding",timezone:"UTC",onboardingKey:randomUUID()};
    const results=await Promise.all([businesses.POST(request("businesses","POST",body)),businesses.POST(request("businesses","POST",body))]);
    const [first,second]=await Promise.all(results.map(r=>r.json()));assert.equal(first.business.id,second.business.id);
    assert.equal((await c.query("SELECT count(*) FROM businesses")).rows[0].count,"1");
    const foreign=await (await businesses.POST(request("businesses","POST",body,"onboard-session-b"))).json();assert.notEqual(foreign.business.id,first.business.id,"request keys cannot cross owners");
    assert.equal((await onboarding.GET(request(`onboarding?businessId=${foreign.business.id}`))).status,404);
    for(const extra of [{timezone:"Invalid/Zone"},{logoUrl:"http://169.254.169.254/metadata"},{logoUrl:"data:image/png;base64,YWJj"},{name:"x".repeat(121)},{onboardingKey:"bad-key"}])assert.equal((await businesses.POST(request("businesses","POST",{...body,...extra}))).status,400);
    const progress=await (await onboarding.GET(request("onboarding"))).json();assert.equal(progress.business.id,first.business.id);assert.equal(progress.reviews,0);
    await c.query("INSERT INTO reviews(business_id,source,rating,text,reviewed_at) VALUES($1,'manual',5,'A synthetic welcome and thoughtful service',now())",[first.business.id]);
    const resumed=await (await onboarding.GET(request(`onboarding?businessId=${first.business.id}`))).json();assert.equal(resumed.reviews,1);
    assert.equal(resumed.business.timezone,"UTC");assert.deepEqual(resumed.drafts,[]);
    await c.query("UPDATE businesses SET onboarding_key=NULL WHERE owner_id='onboard-a'");
    assert.equal((await (await onboarding.GET(request("onboarding"))).json()).business.id,first.business.id,"resume owned legacy businesses without creating duplicates");
    const legacy=(await c.query("INSERT INTO businesses(name,timezone,owner_id) VALUES('Legacy onboarding','UTC','onboard-a') RETURNING id")).rows[0].id;
    assert.equal((await (await onboarding.GET(request("onboarding"))).json()).business.id,legacy,"choose newest owned business if no wizard key exists");
    const drafts=(await c.query("INSERT INTO draft_posts(business_id,quote_text,caption_text,image_path,status) SELECT $1,'Synthetic current draft',CASE WHEN n>5 THEN 'Current preview' ELSE '' END,CASE WHEN n>5 THEN '/api/media/current-'||n||'.png' ELSE NULL END,CASE WHEN n>5 THEN 'draft' ELSE 'archived' END FROM generate_series(1,8) n RETURNING id",[legacy])).rows;
    const current=await (await onboarding.GET(request(`onboarding?businessId=${legacy}`))).json();
    assert.deepEqual(current.drafts.map((d:{id:string})=>d.id),drafts.slice(-5).reverse().map(d=>d.id));
    assert.equal(current.drafts.filter((d:{caption_text:string})=>d.caption_text).length,3,"new successful previews must not be hidden by five old archived rows");
  });
  console.log("onboarding concurrent setup/idempotency/ownership/assets/timezone/resume tests passed");
}
main().catch(err=>{console.error(err);process.exitCode=1;});
