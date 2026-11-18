import { project } from "./project.ts";
import "dotenv/config";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
export const dataDir = path.resolve(process.env.DATA_DIR || "data");
await mkdir(dataDir, { recursive: true });
const embedded = process.env.DATABASE_URL
  ? null
  : new PGlite(path.join(dataDir, "postgres"));
const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null;
type Q = { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> };
export const db: Q = embedded || pool!;
const migration =
  (await readFile(new URL("./migrations/001.sql", import.meta.url), "utf8")) +
  "\n" +
  (await readFile(
    new URL("./migrations/002-domain.sql", import.meta.url),
    "utf8",
  ));
if (embedded) await embedded.exec(migration);
else await pool!.query(migration);
let tail = Promise.resolve();
export async function transaction<T>(
  tenant: string,
  fn: (q: Q) => Promise<T>,
): Promise<T> {
  const run = async () => {
    const c = pool ? await pool.connect() : db;
    try {
      await c.query("BEGIN");
      await c.query("SELECT set_config('app.temple_id',$1,true)", [tenant]);
      const result = await fn(c);
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      if (pool) (c as pg.PoolClient).release();
    }
  };
  if (pool) return run();
  const job = tail.then(run, run);
  tail = job.then(
    () => {},
    () => {},
  );
  return job;
}
export async function close() {
  if (pool) await pool.end();
  if (embedded) await embedded.close();
}

await transaction("", async (q) => {
  for (const r of (
    await q.query(
      "SELECT * FROM records ORDER BY CASE kind WHEN 'category' THEN 1 WHEN 'location' THEN 2 WHEN 'asset' THEN 3 ELSE 4 END",
    )
  ).rows)
    await project(q, r);
});
