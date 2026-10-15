import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { databaseFixture } from "./db-fixture";
import { webFixture } from "./web-fixture";
import { sessionHash } from "../lib/auth-adapter";
async function main(){
  if(process.env.TEST_BROWSER!=="1"){console.log("Browser smoke skipped: set TEST_BROWSER=1 and TEST_DATABASE_URL after build");return;}
  const root=mkdtempSync(join(tmpdir(),"approval-browser-"));process.env.MEDIA_ROOT=root;
  try{await databaseFixture(async c=>{
    await c.query("INSERT INTO auth_users(id,email) VALUES('browser-owner','browser@example.invalid')");
    await c.query("INSERT INTO auth_sessions VALUES($1,'browser-owner',now()+interval '1 hour')",[sessionHash("browser-session")]);
    const bid=(await c.query("INSERT INTO businesses(name,timezone,owner_id) VALUES('Synthetic browser café','UTC','browser-owner') RETURNING id")).rows[0].id;
    writeFileSync(join(root,"preview.png"),await sharp({create:{width:1080,height:1080,channels:3,background:"#1f2937"}}).png().toBuffer());
    const ids:string[]=[];
    for(let n=0;n<4;n++){
      const review=(await c.query("INSERT INTO reviews(business_id,source,source_review_id,rating,text,reviewed_at,author_name) VALUES($1,'manual',$2,5,'Synthetic warm and friendly service',now(),'Example reviewer') RETURNING id",[bid,String(n)])).rows[0].id;
      ids.push((await c.query("INSERT INTO draft_posts(business_id,review_id,quote_text,caption_text,image_path,status) VALUES($1,$2,'Synthetic warm and friendly service',$3,$4,$5) RETURNING id",[bid,review,n===3?"":"Synthetic caption",n===3?null:"/api/media/preview.png",n===3?"failed":"draft"])).rows[0].id);
    }
    await c.query("INSERT INTO generation_periods VALUES($1,'2026-10-12','UTC',5,4,3,'quota_met')",[bid]);
    await c.query("INSERT INTO generation_jobs(business_id,period_start,draft_id,state,attempts,error_code) VALUES($1,'2026-10-12',$2,'failed',3,'generation_failed')",[bid,ids[3]]);
    await webFixture(async base=>{
      const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??"/usr/bin/chromium",headless:true,args:["--no-sandbox"]});
      try{
        const context=await browser.newContext();await context.addCookies([{name:"next-auth.session-token",value:"browser-session",url:base}]);
        assert.equal((await context.request.get(`${base}/api/drafts?businessId=${bid}`)).status(),200,"real draft listing succeeds");
        const page=await context.newPage();const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
        await page.goto(`${base}/approval`);await page.getByRole("combobox").selectOption(String(bid));
        await page.getByText(/Example reviewer/).first().waitFor();
        const item=(id:string)=>page.getByRole("listitem").filter({has:page.getByLabel(`Caption for draft ${id}`)});
        await page.getByLabel(`Caption for draft ${ids[0]}`).fill("Corrected synthetic caption");
        const saved=page.waitForResponse(r=>r.url().endsWith("/api/drafts/caption")&&r.request().method()==="POST");
        await item(ids[0]).getByRole("button",{name:"Save caption",exact:true}).click();assert.equal((await saved).status(),200);
        await page.getByText("Caption: Corrected synthetic caption",{exact:false}).waitFor();
        await page.getByLabel(`Select draft ${ids[0]}`).check();await page.getByLabel(`Select draft ${ids[1]}`).check();
        const bulk=page.waitForResponse(r=>r.url().endsWith("/api/drafts/bulk"));await page.getByRole("button",{name:"Approve selected",exact:true}).click();
        assert.equal((await bulk).status(),200);await page.getByText(/: approved.*: approved/).waitFor();
        const archived=page.waitForResponse(r=>r.url().endsWith("/api/drafts/status"));await item(ids[2]).getByRole("button",{name:"Archive",exact:true}).click();assert.equal((await archived).status(),200);
        await page.getByText(/generation_failed/).waitFor();
        const retry=page.waitForResponse(r=>r.url().endsWith("/api/generation/retry"));await item(ids[3]).getByRole("button",{name:"Retry failed job",exact:true}).click();assert.equal((await retry).status(),202);
        if(process.env.BROWSER_EVIDENCE_PATH)await page.screenshot({path:process.env.BROWSER_EVIDENCE_PATH,fullPage:true});
        assert.deepEqual(errors,[]);await context.close();
      }finally{await browser.close();}
    });
    assert.equal((await c.query("SELECT count(*) FROM draft_posts WHERE status='approved'")).rows[0].count,"2");
    assert.equal((await c.query("SELECT status FROM draft_posts WHERE id=$1",[ids[2]])).rows[0].status,"archived");
    assert.equal((await c.query("SELECT state FROM generation_jobs WHERE draft_id=$1",[ids[3]])).rows[0].state,"pending");
    assert.ok(Number((await c.query("SELECT count(*) FROM draft_events WHERE actor_id='browser-owner'")).rows[0].count)>=5);
    console.log("Chromium source/edit/preview/bulk approve/archive/failed retry browser flow passed");
  });}finally{rmSync(root,{recursive:true,force:true});}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
