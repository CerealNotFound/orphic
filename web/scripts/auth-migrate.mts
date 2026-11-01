// Creates/updates Better Auth's tables (user, session, account, verification).
import { getMigrations } from "better-auth/db/migration";
import { auth } from "../src/lib/auth";
import { pool } from "../src/lib/db";

const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);
console.log(`auth tables to create: ${toBeCreated.map((t) => t.table).join(", ") || "none"}; columns to add: ${toBeAdded.length}`);
await runMigrations();
console.log("auth schema up to date");
await pool.end();
