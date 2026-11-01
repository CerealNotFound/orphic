// Copies the production settings from .env.local into the linked Vercel project without printing any value.
// Usage: pnpm tsx scripts/push-env.mts [APP_URL]
// Fresh random values are generated for CRON_SECRET and BETTER_AUTH_SECRET (production-only secrets).
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const local = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);

const COPY = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_USERNAME", "TELEGRAM_WEBHOOK_SECRET", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
const values: Record<string, string> = {};
for (const k of COPY) if (local[k]) values[k] = local[k];
values.CRON_SECRET = randomBytes(32).toString("hex");
values.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
const appUrl = process.argv[2];
if (appUrl) {
  values.APP_URL = appUrl;
  values.BETTER_AUTH_URL = appUrl;
}
// Never pushed: DATABASE_URL (comes from the Neon integration), ORPHIC_DEV_MEMBER_ID (dev only), worker settings.

for (const [name, value] of Object.entries(values)) {
  if (name === "CRON_SECRET" || name === "BETTER_AUTH_SECRET") {
    // Don't rotate these on every run: only add if missing.
    const ls = spawnSync("vercel", ["env", "ls", "production"], { encoding: "utf8" });
    if (ls.stdout.includes(name)) {
      console.log(`kept     ${name} (already set)`);
      continue;
    }
  }
  spawnSync("vercel", ["env", "rm", name, "production", "--yes"], { encoding: "utf8" });
  const r = spawnSync("vercel", ["env", "add", name, "production"], { input: value, encoding: "utf8" });
  console.log(`${r.status === 0 ? "set     " : "FAILED  "} ${name}${r.status === 0 ? "" : `: ${(r.stderr || r.stdout).trim().split("\n").pop()}`}`);
}
