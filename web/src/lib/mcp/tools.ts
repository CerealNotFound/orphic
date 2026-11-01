// Orphic tools for AI clients (Claude, ChatGPT, Cursor…). No LLM runs on our side: tools only search and return data.
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { CATEGORIES, ENTITY_KINDS } from "../contracts";
import { q, q1 } from "../db";
import { enqueueJob } from "../jobs";
import { facets, getEntity, listEntities, searchEntities, type EntityHit, type Page } from "../search";
import { entityUrl } from "../telegram/cards";
import { extractUrls, instagramShortcode } from "../text";
import { libraryMarkdown } from "../agent-markdown";
import { env } from "../env";
import { catalogueData } from "../public-catalogue";
import { REVOCABLE } from "../public-links";

export type Principal = { workspaceId: string; memberId: string | null; scopes: string[] };

type ToolCtx = { http?: { authInfo?: { scopes: string[]; extra?: Record<string, unknown> } } };

function principalOf(ctx: ToolCtx): Principal {
  const info = ctx.http?.authInfo;
  const ws = info?.extra?.workspaceId;
  if (!info || typeof ws !== "string") throw new Error("Not authenticated");
  return { workspaceId: ws, memberId: (info.extra?.memberId as string | null) ?? null, scopes: info.scopes };
}

/**
 * Drive folders, Google Docs and Notion pages can be taken down by their owner, so we hand out our saved copy instead.
 * Slug → saved copy URL, from the cached catalogue (no database work). Only for this workspace's catalogue.
 */
async function savedCopies(workspaceId: string): Promise<Map<string, string>> {
  const c = await catalogueData();
  if (c.workspaceId !== workspaceId) return new Map();
  return new Map(c.entries.filter((e) => e.href !== e.url).map((e) => [e.slug, `${env.APP_URL}${e.href}`]));
}

function links(e: { slug: string; canonical_url: string | null }, copies: Map<string, string>) {
  const copy = copies.get(e.slug);
  if (copy) return { url: copy, original_url: e.canonical_url, url_note: "Saved copy: the original link can be taken down, this one stays." };
  if (e.canonical_url && REVOCABLE.test(e.canonical_url))
    return { url: e.canonical_url, url_note: "The owner can take this link down; the team's saved copy is on orphic_url." };
  return { url: e.canonical_url };
}

const concise = (e: EntityHit, copies: Map<string, string>) => ({
  id: e.id,
  name: e.name,
  kind: e.kind,
  summary: e.summary,
  ...links(e, copies),
  ...(e.matched_by ? { matched_by: e.matched_by } : {}),
  link_status: e.link_status,
  category: e.category,
  tags: e.tags,
  use_cases: e.use_cases,
  pricing: e.pricing,
  saved_by: e.savers,
  saves: e.save_count,
  rating: e.rating_score,
  orphic_url: entityUrl(e.slug),
});

function pageResult(p: Page<EntityHit>, copies: Map<string, string>, note?: string) {
  const shown = p.items.length ? `${p.offset + 1}-${p.offset + p.items.length}` : "0";
  const coverage =
    p.next_offset === null
      ? `Showing ${shown} of ${p.total}: this is every match.`
      : `Showing ${shown} of ${p.total}. More matches exist; call again with offset=${p.next_offset} before concluding.`;
  // Be honest when nothing matched the words or the name: what's left is only loosely related.
  let match_quality: string | undefined;
  if (p.strong_total !== undefined && p.total > 0) {
    if (p.strong_total === 0)
      match_quality = `No item matches these words or a name. These ${p.total} are only loosely related in meaning: treat them as suggestions, not answers, and say so.`;
    else if (p.strong_total < p.total)
      match_quality = `${p.strong_total} match the words or a name (listed first); the other ${p.total - p.strong_total} are only similar in meaning (matched_by: ["meaning"]).`;
  }
  const payload = {
    total_matches: p.total,
    ...(p.strong_total !== undefined ? { strong_matches: p.strong_total } : {}),
    returned: p.items.length,
    next_offset: p.next_offset,
    coverage,
    match_quality,
    note,
    items: p.items.map((e) => concise(e, copies)),
  };
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 1) }], structuredContent: payload };
}

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
/** A refusal or failure: marked as an error so the AI doesn't report it as done. */
const fail = (s: string) => ({ content: [{ type: "text" as const, text: s }], isError: true });
const READ = { readOnlyHint: true, openWorldHint: false } as const;

export function registerOrphicTools(server: McpServer) {
  server.registerTool(
    "search_items",
    {
      title: "Search Orphic",
      description:
        "Search the team's saved AI tools, workflows, prompts and resources (captured from Instagram reels and links). " +
        "Use for fuzzy questions like 'tool for turning podcasts into clips' or a half-remembered name. Hybrid keyword + fuzzy-name + semantic ranking. " +
        "Results include total_matches; if next_offset is not null there are more matches. For 'list everything about X' use list_items instead.",
      inputSchema: z.object({
        query: z.string().min(1).describe("What the user is looking for, in natural language or a name"),
        category: z.enum(CATEGORIES).optional(),
        kind: z.enum(ENTITY_KINDS).optional(),
        tag: z.string().optional(),
        limit: z.number().int().min(1).max(30).default(10),
        offset: z.number().int().min(0).default(0),
      }),
      annotations: READ,
    },
    async (args, ctx) => {
      const p = principalOf(ctx as ToolCtx);
      const [page, copies] = await Promise.all([searchEntities(p.workspaceId, args.query, args), savedCopies(p.workspaceId)]);
      return pageResult(page, copies, page.total === 0 ? "No matches. Try different words or list_facets to see what exists before saying it's not saved." : undefined);
    },
  );

  server.registerTool(
    "list_items",
    {
      title: "List Orphic items",
      description:
        "Exhaustive listing with filters: returns EVERY item matching the filters (paginated, with total_matches). " +
        "Use for 'show me everything about video editing', 'what did Riya save', 'what's waiting on a DM link'. Call list_facets to see valid categories/tags.",
      inputSchema: z.object({
        category: z.enum(CATEGORIES).optional(),
        kind: z.enum(ENTITY_KINDS).optional(),
        tag: z.string().optional(),
        text: z.string().optional().describe("Optional keywords; matches any word"),
        saved_by: z.string().optional().describe("Teammate's display name"),
        link_status: z.enum(["verified", "unverified", "pending_dm", "saved", "unavailable", "none"]).optional(),
        since: z.string().optional().describe("ISO date, e.g. 2026-10-01"),
        limit: z.number().int().min(1).max(50).default(25),
        offset: z.number().int().min(0).default(0),
      }),
      annotations: READ,
    },
    async (args, ctx) => {
      const p = principalOf(ctx as ToolCtx);
      let savedBy: string | undefined;
      if (args.saved_by) {
        const m = await q1<{ id: string }>(`select id from members where workspace_id = $1 and display_name ilike $2 limit 1`, [p.workspaceId, `%${args.saved_by}%`]);
        if (!m) return fail(`No teammate named "${args.saved_by}".`);
        savedBy = m.id;
      }
      const [page, copies] = await Promise.all([listEntities(p.workspaceId, { ...args, saved_by: savedBy }), savedCopies(p.workspaceId)]);
      return pageResult(page, copies);
    },
  );

  server.registerTool(
    "get_item",
    {
      title: "Get an Orphic item",
      description: "Full details for one item: link, summary, use cases, who saved it, ratings, and the source reels/links with captions.",
      inputSchema: z.object({ id: z.string().describe("Item id (uuid) or slug from search results") }),
      annotations: READ,
    },
    async ({ id }, ctx) => {
      const p = principalOf(ctx as ToolCtx);
      const [e, copies] = await Promise.all([getEntity(p.workspaceId, id), savedCopies(p.workspaceId)]);
      if (!e) return fail(`No item with id/slug "${id}".`);
      return text(JSON.stringify({ ...e, ...links(e, copies), orphic_url: entityUrl(e.slug) }, null, 1));
    },
  );

  server.registerTool(
    "list_facets",
    {
      title: "What's in Orphic",
      description: "Counts of items by category, kind and tag, plus totals. Use to see what exists before filtering or before saying something isn't saved.",
      inputSchema: z.object({}),
      annotations: READ,
    },
    async (_args, ctx) => text(JSON.stringify(await facets(principalOf(ctx as ToolCtx).workspaceId), null, 1)),
  );

  server.registerTool(
    "read_library",
    {
      title: "Read the Orphic library (Markdown)",
      description:
        "The team's library as Markdown, complete (never a sample). By default a short list: one line per item (name, what it is, link, slug), " +
        "grouped by category, with the size of the full version. With query: every match, best first. With item: that one item in full " +
        "(use cases, tags, who saved it, rating, source reels, saved copies). detail='full' gives every item in full: large for the whole library, " +
        "so read the short list first and fetch items one by one unless you really need everything.",
      inputSchema: z.object({
        query: z.string().optional().describe("Optional search in the user's words"),
        category: z.enum(CATEGORIES).optional(),
        tag: z.string().optional(),
        item: z.string().optional().describe("Slug or id of one item (always in full)"),
        detail: z.enum(["brief", "full"]).default("brief").describe("brief: one line per item (default). full: every detail for every item"),
      }),
      annotations: READ,
    },
    async (args, ctx) => {
      const p = principalOf(ctx as ToolCtx);
      const { markdown } = await libraryMarkdown(p.workspaceId, { q: args.query, category: args.category, tag: args.tag, item: args.item, detail: args.detail });
      return text(markdown);
    },
  );

  server.registerTool(
    "save_link",
    {
      title: "Save to Orphic",
      description: "Queue a reel or link to be processed and saved to the team's Orphic (same as sending it to the Telegram bot).",
      inputSchema: z.object({ url: z.url(), note: z.string().max(300).optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ url, note }, ctx) => {
      const p = principalOf(ctx as ToolCtx);
      if (!p.scopes.includes("write")) return fail("Not saved: this connection is read-only. Use a key with write access.");
      if (!p.memberId) return fail("Not saved: this key isn't linked to a teammate.");
      const tg = await q1<{ telegram_user_id: string | null }>(`select telegram_user_id from members where id = $1`, [p.memberId]);
      const clean = extractUrls(url)[0] ?? url;
      const id = await enqueueJob({
        workspaceId: p.workspaceId,
        memberId: p.memberId,
        kind: instagramShortcode(clean) ? "reel" : "link",
        input: { url: clean, note },
        chatId: tg?.telegram_user_id ? Number(tg.telegram_user_id) : null,
        messageId: null,
      });
      return text(`Queued as #${id}. It'll be processed shortly${tg?.telegram_user_id ? " and the result sent to your Telegram" : ""}.`);
    },
  );

  server.registerTool(
    "rate_item",
    {
      title: "Rate an Orphic item",
      description: "Record whether a tool worked for you (+1) or was overhyped (-1). Ratings rank items for the whole team.",
      inputSchema: z.object({ id: z.string(), value: z.union([z.literal(1), z.literal(-1)]), comment: z.string().max(300).optional() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, value, comment }, ctx) => {
      const p = principalOf(ctx as ToolCtx);
      if (!p.scopes.includes("write") || !p.memberId) return fail("Not rated: this connection can't rate items (read-only, or not linked to a teammate).");
      const e = await getEntity(p.workspaceId, id);
      if (!e) return fail(`No item "${id}".`);
      await q(
        `insert into ratings (entity_id, member_id, workspace_id, value, comment) values ($1,$2,$3,$4,$5)
         on conflict (entity_id, member_id) do update set value = excluded.value, comment = excluded.comment, created_at = now()`,
        [e.id, p.memberId, p.workspaceId, value, comment ?? null],
      );
      await q(`update entities set rating_score = (select coalesce(sum(value), 0) from ratings where entity_id = $1) where id = $1`, [e.id]);
      return text(`Rated ${e.name} ${value > 0 ? "👍" : "👎"}.`);
    },
  );
}
