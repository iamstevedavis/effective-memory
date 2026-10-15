import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { getSchedulerAdapter, scheduleApprovedDraft, StubSchedulerAdapter, SchedulerUnavailable } from "../lib/integrations/scheduler";
async function main(){
  assert.throws(()=>getSchedulerAdapter(),SchedulerUnavailable);
  const payload={draftPostId:1,businessId:1,quoteText:"SYNTHETIC_PRIVATE_QUOTE",captionText:"SYNTHETIC_PRIVATE_CAPTION",imagePath:"/api/media/private.png",scheduledFor:"2026-12-01T10:00:00.000Z"};
  await assert.rejects(scheduleApprovedDraft(payload),/No post was submitted/);
  const fake=await new StubSchedulerAdapter().schedulePost(payload);
  assert.deepEqual([fake.provider,fake.confirmed,fake.status],["fake",false,"simulated"]);
  const result=spawnSync(process.execPath,["-r","ts-node/register","scripts/schedule-worker.ts"],{encoding:"utf8",env:{...process.env,DATABASE_URL:"postgres://invalid.invalid/must-not-connect"}});
  assert.equal(result.status,1);assert.doesNotMatch(result.stdout+result.stderr,/SYNTHETIC_PRIVATE|scheduledCount|scheduler\.stub/);
  console.log("unconfigured scheduler/fake receipts/retired CLI fail-closed tests passed");
}
main().catch(err=>{console.error(err);process.exitCode=1;});
