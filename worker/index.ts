import { pool } from "../lib/db";
import { runDraftGenerationJob } from "../lib/services/draftPipeline";

const TICK_MS = Number(process.env.DRAFT_PIPELINE_INTERVAL_MS ?? 60_000);
let running = false;
let stopped = false;

async function runTick() {
  if (running || stopped) return;
  running = true;

  try {
    const result = await runDraftGenerationJob({ perBusinessLimit: 5 });
    console.log(
      JSON.stringify({
        event: "draft_pipeline.run_complete",
        ...result
      })
    );
  } catch (err) {
    console.error("draft_pipeline_failed", err instanceof Error ? err.message : String(err));
  } finally {
    running = false;
  }
}

async function shutdown(signal: string) {
  if (stopped) return;
  stopped = true;
  console.log(`[${new Date().toISOString()}] shutting down worker (${signal})`);

  while (running) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  await pool.end();
  process.exit(0);
}

function main() {
  console.log(`[${new Date().toISOString()}] worker up`);
  runTick();
  setInterval(runTick, TICK_MS);

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main();
