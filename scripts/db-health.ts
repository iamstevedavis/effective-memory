import { query, pool } from "../lib/db";

async function run() {
  const result = await query<{ now: string }>("SELECT NOW()::text AS now");
  console.log(JSON.stringify({ ok: true, now: result.rows[0]?.now }, null, 2));
  await pool.end();
}

run().catch(async (err) => {
  console.error(JSON.stringify({ ok: false, error: String(err) }, null, 2));
  await pool.end();
  process.exit(1);
});
