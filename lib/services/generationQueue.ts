import { Queue, Worker } from "bullmq";
import { query, transaction } from "../db";
import { processGeneration, requestGeneration } from "./generation";
export function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  if (!["redis:","rediss:"].includes(url.protocol)) throw new Error("REDIS_URL must use redis or rediss");
  return { host:url.hostname,port:Number(url.port || 6379),username:url.username || undefined,password:decodeURIComponent(url.password) || undefined,db:Number(url.pathname.slice(1) || 0),maxRetriesPerRequest:null,...(url.protocol === "rediss:" ? {tls:{}} : {}) };
}
export function generationQueue() {
  const connection = redisConnection();
  const queue = new Queue("praise-generation",{connection:{...connection,maxRetriesPerRequest:1}});
  const worker = new Worker("praise-generation",async job=> { await processGeneration(Number(job.data.id)); },{connection,concurrency:2});
  worker.on("error",()=>console.error("generation_queue_unavailable"));
  queue.on("error",()=>console.error("generation_queue_unavailable"));
  return { queue,worker };
}
export async function generationTick(queue: Queue, now = new Date()) {
  const businesses = await query("SELECT id FROM businesses WHERE owner_id IS NOT NULL ORDER BY id");
  for (const b of businesses.rows) { try { await requestGeneration(Number(b.id),5,now); } catch { console.error("generation_reservation_failed"); } }
  await transaction(async c=>{
    const exhausted = await c.query("UPDATE generation_jobs SET state='failed',error_code='worker_interrupted',lease=NULL WHERE state='running' AND lease_until<$1 AND attempts>=3 RETURNING draft_id",[now]);
    for (const row of exhausted.rows) await c.query("UPDATE draft_posts SET status='failed',audit_note='worker_interrupted' WHERE id=$1 AND status IN ('draft','failed')",[row.draft_id]);
  });
  const pending = await query("SELECT id FROM generation_jobs WHERE attempts<3 AND ((state IN ('pending','retry') AND next_at<=$1) OR (state='running' AND lease_until<$1)) ORDER BY id LIMIT 100",[now]);
  for (const job of pending.rows) await queue.add("draft",{id:job.id},{jobId:`generation-${job.id}`,removeOnComplete:true,removeOnFail:true});
  return {businesses:businesses.rowCount,dispatched:pending.rowCount};
}
