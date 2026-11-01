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

export type Principal = { workspaceId: string; memberId: string | null; scopes: string[] };

type ToolCtx = { http?: { authInfo?: { scopes: string[]; extra?: Record<string, unknown> } } };

function principalOf(ctx: ToolCtx): Principal {
  const info = ctx.http?.authInfo;
  const ws = info?.extra?.workspaceId;
  if (!info || typeof ws !== "string") throw new Error("Not authenticated");
  return { workspaceId: ws, memberId: (info.extra?.memberId as string | null) ?? null, scopes: info.scopes };
}

const concise = (e: EntityHit) => ({
  id: e.id,
  name: e.name,
  kind: e.kind,
  summary: e.summary,
  url: e.canonical_url,
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

function pageResult(p: Page<EntityHit>, note?: string) {
  const shown = p.items.length ? `${p.offset + 1}-${p.offset + p.items.length}` : "0";
  const coverage =
    p.next_offset === null
      ? `Showing ${shown} of ${p.total}: this is every match.`
      : `Showing ${shown} of ${p.total}. More matches exist; call again with offset=${p.next_offset} before concluding.`;
  const payload = { total_matches: p.total, returned: p.items.length, next_offset: p.next_offset, coverage, note, items: p.items.map(concise) };
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 1) }], structuredContent: payload };
}

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
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
      const page = await searchEntities(p.workspaceId, args.query, args);
      return pageResult(page, page.total === 0 ? "No matches. Try different words or list_facets to see what exists before saying it's not saved." : undefined);
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
        if (!m) return text(`No teammate named "${args.saved_by}".`);
        savedBy = m.id;
      }
      return pageResult(await listEntities(p.workspaceId, { ...args, saved_by: savedBy }));
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
      const e = await getEntity(p.workspaceId, id);
      return e ? text(JSON.stringify({ ...e, orphic_url: entityUrl(e.slug) }, null, 1)) : text(`No item with id/slug "${id}".`);
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
        "Returns the team's library as one Markdown document with full details for every item: link and whether it's verified, summary, use cases, " +
        "tags, related terms, who saved it, rating and source reels. With no arguments: everything, grouped by category (use this for overviews, " +
        "comparisons or 'what do we have for X' when you want to read it all yourself). With query: every match, best first. With item: one item. " +
        "The list is complete, not a sample.",
      inputSchema: z.object({
        query: z.string().optional().describe("Optional search in the user's words"),
        category: z.enum(CATEGORIES).optional(),
        tag: z.string().optional(),
        item: z.string().optional().describe("Slug or id of one item"),
      }),
      annotations: READ,
    },
    async (args, ctx) => {
      const p = principalOf(ctx as ToolCtx);
      const { markdown } = await libraryMarkdown(p.workspaceId, { q: args.query, category: args.category, tag: args.tag, item: args.item });
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
      if (!p.scopes.includes("write")) return text("This connection is read-only.");
      if (!p.memberId) return text("This key isn't linked to a teammate, so it can't save.");
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
      if (!p.scopes.includes("write") || !p.memberId) return text("This connection can't rate items.");
      const e = await getEntity(p.workspaceId, id);
      if (!e) return text(`No item "${id}".`);
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
