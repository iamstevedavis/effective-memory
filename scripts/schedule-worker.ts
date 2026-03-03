import { query, pool } from "../lib/db";
import { getSchedulerAdapter } from "../lib/integrations/scheduler";

async function runOnce() {
  const adapter = getSchedulerAdapter();

  const rows = await query<{
    id: number;
    business_id: number;
    quote_text: string;
    caption_text: string;
    image_path: string | null;
    scheduled_for: string;
  }>(
    `SELECT id, business_id, quote_text, caption_text, image_path, scheduled_for::text
     FROM draft_posts
     WHERE status = 'approved'
       AND scheduled_for IS NOT NULL
       AND scheduled_for <= NOW()
     ORDER BY scheduled_for ASC
     LIMIT 25`
  );

  let scheduledCount = 0;

  for (const row of rows.rows) {
    await adapter.schedulePost({
      draftPostId: row.id,
      businessId: row.business_id,
      quoteText: row.quote_text,
      captionText: row.caption_text,
      imagePath: row.image_path,
      scheduledFor: row.scheduled_for
    });

    await query(
      `UPDATE draft_posts
       SET status = 'scheduled', updated_at = NOW()
       WHERE id = $1`,
      [row.id]
    );

    scheduledCount += 1;
  }

  console.log(JSON.stringify({ event: "scheduler.stub.run_complete", scheduledCount }));
}

runOnce()
  .catch((err) => {
    console.error("scheduler_stub_failed", err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
