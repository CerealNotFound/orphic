import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { env } from "./env";

declare global {
  var __orphicPool: Pool | undefined;
}

function createPool() {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10_000,
  });
  // On Vercel Fluid compute this releases idle connections before the instance suspends.
  attachDatabasePool(pool);
  return pool;
}

export const pool: Pool = globalThis.__orphicPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalThis.__orphicPool = pool;

export async function q<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function q1<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
