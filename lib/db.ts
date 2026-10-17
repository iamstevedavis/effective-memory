import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, QueryResultRow } from "pg";

const transactions = new AsyncLocalStorage<import("pg").PoolClient>();
let poolInstance: Pool | null = null;

function getPool() {
  if (poolInstance) return poolInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  poolInstance = new Pool({ connectionString: databaseUrl });
  return poolInstance;
}

export const pool = {
  connect: () => getPool().connect(),
  end: async () => { if (poolInstance) { await poolInstance.end(); poolInstance = null; } }
};

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  return (transactions.getStore() ?? getPool()).query<T>(text, params);
}

export async function transaction<T>(run: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const existing = transactions.getStore();
  if (existing) return run(existing);
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await transactions.run(client, () => run(client)); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
