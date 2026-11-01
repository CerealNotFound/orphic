// Applies db/migrations/*.sql in order. Usage: pnpm db:migrate
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const dir = join(import.meta.dirname, "..", "..", "db", "migrations");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await client.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    process.stdout.write(`applying ${f}... `);
    await client.query("begin");
    try {
      await client.query(readFileSync(join(dir, f), "utf8"));
      await client.query("insert into schema_migrations (name) values ($1)", [f]);
      await client.query("commit");
      console.log("ok");
    } catch (err) {
      await client.query("rollback");
      console.log("failed");
      throw err;
    }
  }
  await client.end();
  console.log("migrations up to date");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
