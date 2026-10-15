import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pool } from "../lib/db";
export async function databaseFixture(run: (client: PoolClient) => Promise<void>, before?: (name: string, client: PoolClient) => Promise<void>) {
  if (!process.env.TEST_DATABASE_URL) { console.log("Postgres fixture skipped: set TEST_DATABASE_URL"); return; }
  const schema = `fixture_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  const fixture = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await fixture.connect();
  try {
    for (const name of readdirSync("db/migrations").filter(n => n.endsWith(".sql")).sort()) {
      await before?.(name, client);
      await client.query(readFileSync(join("db/migrations", name), "utf8"));
    }
    await run(client);
  } finally {
    client.release(); await pool.end(); await fixture.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
  }
}
