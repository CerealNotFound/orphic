// Admin CLI. Usage: pnpm orphic <command>
//   setup "<Team name>"            create the workspace, an invite link and the worker API key
//   invite                         new invite link for the (single) workspace
//   key <worker|read|write> [name] new API key
//   webhook <https://public-url>   point Telegram at <url>/api/telegram
//   webhook-info                   show Telegram's webhook status
//   embed-all                      (re)embed every entity (after adding VOYAGE_API_KEY)
//   waitlist                       people who signed up on the public coming-soon page
//   delete <slug|name>… [--yes]    remove items saved by mistake (shows what would change; --yes applies it)
import { Api } from "grammy";
import { pool, q, q1, tx } from "../src/lib/db";
import { refreshSearchDocs } from "../src/lib/jobs";
import { createApiKey, type Scope } from "../src/lib/keys";
import { createInvite, createWorkspace } from "../src/lib/members";
import { embedEntities } from "../src/lib/embeddings";

const [cmd, ...args] = process.argv.slice(2);

async function onlyWorkspace() {
  const rows = await q<{ id: string; name: string }>(`select id, name from workspaces order by created_at`);
  if (rows.length === 0) throw new Error('No workspace yet. Run: pnpm orphic setup "Team name"');
  if (rows.length > 1) console.warn(`Several workspaces exist; using the first (${rows[0].name}).`);
  return rows[0];
}

function inviteLink(code: string) {
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  return bot ? `https://t.me/${bot}?start=${code}` : `(set TELEGRAM_BOT_USERNAME) start code: ${code}`;
}

async function main() {
  switch (cmd) {
    case "setup": {
      const name = args[0] ?? "Orphic";
      const existing = await q1(`select id from workspaces limit 1`);
      if (existing) throw new Error("A workspace already exists. Use `pnpm orphic invite` / `pnpm orphic key`.");
      const ws = await createWorkspace(name);
      const code = await createInvite(ws.id, { role: "admin", maxUses: 1 });
      const memberCode = await createInvite(ws.id);
      const workerKey = await createApiKey({ workspaceId: ws.id, name: "mac-worker", scopes: ["worker"] });
      console.log(`Workspace "${name}" created.\n`);
      console.log(`1. Open this link yourself first (you become the owner):\n   ${inviteLink(code)}\n`);
      console.log(`2. Share this one with the team (50 uses):\n   ${inviteLink(memberCode)}\n`);
      console.log(`3. Worker key (saved as ORPHIC_WORKER_KEY in web/.env.local; shown once):\n   ${workerKey}`);
      break;
    }
    case "invite": {
      const ws = await onlyWorkspace();
      console.log(inviteLink(await createInvite(ws.id)));
      break;
    }
    case "key": {
      const scope = (args[0] ?? "read") as Scope;
      if (!["worker", "read", "write"].includes(scope)) throw new Error("scope must be worker, read or write");
      const ws = await onlyWorkspace();
      const scopes: Scope[] = scope === "write" ? ["read", "write"] : [scope];
      console.log(await createApiKey({ workspaceId: ws.id, name: args[1] ?? `${scope}-key`, scopes }));
      break;
    }
    case "webhook": {
      const base = args[0]?.replace(/\/$/, "");
      if (!base?.startsWith("https://")) throw new Error("Usage: pnpm orphic webhook https://your-app.vercel.app");
      const api = new Api(process.env.TELEGRAM_BOT_TOKEN!);
      await api.setWebhook(`${base}/api/telegram`, {
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ["message", "callback_query", "inline_query"],
        drop_pending_updates: false,
      });
      console.log(`Webhook set to ${base}/api/telegram`);
      break;
    }
    case "webhook-info": {
      console.log(await new Api(process.env.TELEGRAM_BOT_TOKEN!).getWebhookInfo());
      break;
    }
    case "waitlist": {
      const rows = await q<{ email: string; created_at: string }>(`select email, created_at from waitlist order by created_at`);
      for (const r of rows) console.log(`${new Date(r.created_at).toISOString().slice(0, 10)}  ${r.email}`);
      console.log(`${rows.length} signup(s)`);
      break;
    }
    case "embed-all": {
      const ids = (await q<{ id: string }>(`select id from entities`)).map((r) => r.id);
      for (let i = 0; i < ids.length; i += 50) await embedEntities(ids.slice(i, i + 50));
      console.log(`embedded ${ids.length} entities`);
      break;
    }
    case "delete": {
      const apply = args.includes("--yes");
      const targets = args.filter((a) => a !== "--yes");
      if (!targets.length) throw new Error('Usage: pnpm orphic delete <slug or exact name> … [--yes]');
      const ws = await onlyWorkspace();
      await deleteEntities(ws.id, targets, apply);
      break;
    }
    default:
      console.log("Commands: setup, invite, key, webhook, webhook-info, embed-all, waitlist, delete");
  }
}

/**
 * Deletes items saved by mistake. When an item was the main item of a reel or link, the next item from the same
 * post (in the order the worker listed them, linked items first) becomes the main item, so the source stays reachable.
 */
async function deleteEntities(workspaceId: string, targets: string[], apply: boolean) {
  type Row = { id: string; name: string; slug: string; canonical_url: string | null };
  const found: Row[] = [];
  for (const t of targets) {
    const rows = await q<Row>(
      `select id, name, slug, canonical_url from entities where workspace_id = $1 and (slug = $2 or lower(name) = lower($2))`,
      [workspaceId, t.trim()],
    );
    if (rows.length === 0) console.log(`✗ Not found: "${t}" (use the slug from the item's web address, or its exact name)`);
    else if (rows.length > 1) console.log(`✗ "${t}" matches ${rows.length} items; use the slug instead: ${rows.map((r) => r.slug).join(", ")}`);
    else if (!found.some((f) => f.id === rows[0].id)) found.push(rows[0]);
  }
  if (!found.length) return;
  const ids = found.map((f) => f.id);

  await tx(async (c) => {
    const promoted: string[] = [];
    for (const e of found) {
      console.log(`\n• ${e.name}  (${e.slug})${e.canonical_url ? `  ${e.canonical_url}` : "  no link"}`);
      const caps = (
        await c.query<{ capture_id: string; role: string; source_url: string | null }>(
          `select ce.capture_id, ce.role, cp.source_url from capture_entities ce join captures cp on cp.id = ce.capture_id
           where ce.entity_id = $1 and cp.workspace_id = $2`,
          [e.id, workspaceId],
        )
      ).rows;
      for (const cap of caps) {
        if (cap.role !== "primary") continue;
        const hasPrimary = (
          await c.query(`select 1 from capture_entities where capture_id = $1 and role = 'primary' and not (entity_id = any($2))`, [cap.capture_id, ids])
        ).rows[0];
        if (hasPrimary) continue;
        // Order of the worker's result for this post, so "the first tool listed" wins.
        const listed = (
          await c.query<{ names: string[] | null }>(
            `select array(select lower(x->>'name') from jsonb_array_elements(result->'entities') x) as names
             from jobs where capture_id = $1 and workspace_id = $2 and result is not null order by updated_at desc limit 1`,
            [cap.capture_id, workspaceId],
          )
        ).rows[0]?.names ?? [];
        const siblings = (
          await c.query<{ id: string; name: string; aliases: string[]; link_status: string }>(
            `select e.id, e.name, e.aliases, e.link_status from capture_entities ce join entities e on e.id = ce.entity_id
             where ce.capture_id = $1 and e.workspace_id = $2 and not (e.id = any($3)) order by e.created_at`,
            [cap.capture_id, workspaceId, ids],
          )
        ).rows;
        const pos = (s: (typeof siblings)[number]) => {
          const names = [s.name, ...s.aliases].map((n) => n.toLowerCase());
          const i = listed.findIndex((n) => names.includes(n));
          return i < 0 ? listed.length : i;
        };
        const next = siblings.sort((a, b) => Number(b.link_status === "verified") - Number(a.link_status === "verified") || pos(a) - pos(b))[0];
        if (!next) {
          console.log(`    source ${cap.source_url ?? cap.capture_id}: no other item; the source stays saved with no item`);
          continue;
        }
        console.log(`    source ${cap.source_url ?? cap.capture_id}: "${next.name}" becomes the main item`);
        if (apply) {
          await c.query(`update capture_entities set role = 'primary' where capture_id = $1 and entity_id = $2`, [cap.capture_id, next.id]);
          promoted.push(next.id);
        }
      }
      const tasks = (await c.query<{ n: string }>(`select count(*) as n from tasks where entity_id = $1 and status = 'open'`, [e.id])).rows[0];
      if (Number(tasks.n)) console.log(`    ${tasks.n} open DM to-do(s) for this item will be removed too`);
    }
    if (!apply) {
      console.log(`\nNothing changed. Run again with --yes to delete ${found.length} item(s).`);
      return;
    }
    await c.query(`delete from entities where workspace_id = $1 and id = any($2)`, [workspaceId, ids]);
    await refreshSearchDocs(c, [...new Set(promoted)]);
    console.log(`\nDeleted ${found.length} item(s).`);
  });
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
