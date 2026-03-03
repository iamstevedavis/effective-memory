import { Pool, QueryResultRow } from "pg";

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
  end: () => (poolInstance ? poolInstance.end() : Promise.resolve())
};

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  return getPool().query<T>(text, params);
}
