// The open Orphic MCP server: anyone's AI can search the public catalogue. No key, no sign-in.
// Cheap by design: every tool reads the cached catalogue (one database query per server instance per hour, see
// catalogueData), runs the same in-memory search as the website, and never calls a paid service (no embeddings).
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { CATEGORIES, ENTITY_KINDS } from "../contracts";
import { env } from "../env";
import { catalogueData, catalogueEntry, searchPublic, type CatalogueEntry } from "../public-catalogue";

const READ = { readOnlyHint: true, openWorldHint: false, idempotentHint: true } as const;
const abs = (path: string) => (path.startsWith("http") ? path : `${env.APP_URL}${path}`);

/** One tool as the AI sees it. `url` is our saved copy for Drive/Docs/Notion links (their owner can take those down). */
function shape(e: CatalogueEntry, full = false) {
  const copy = e.href !== e.url;
  return {
    name: e.name,
    slug: e.slug,
    kind: e.kind,
    category: e.category,
    summary: e.summary,
    url: abs(e.href),
    ...(copy ? { original_url: e.url, url_note: "Saved copy: the original link can be taken down, this one stays." } : {}),
    page: abs(`/explore/${e.slug}`),
    markdown: abs(`/explore/${e.slug}.md`),
    use_cases: e.useCases,
    tags: e.tags,
    ...(full
      ? {
          found_in: e.sources.map((s) => ({ platform: s.platform, creator: s.creator ? `@${s.creator.replace(/^@/, "")}` : null, url: s.url, date: s.date.slice(0, 10) })),
          first_seen: e.firstSeen.slice(0, 10),
        }
      : {}),
  };
}

/** One short line per tool, for browsing many at once. */
function brief(e: CatalogueEntry) {
  const t = e.summary.replace(/\s+/g, " ").trim();
  const first = t.split(/(?<=[.!?])\s/)[0];
  return { name: e.name, slug: e.slug, kind: e.kind, category: e.category, summary: first.length <= 150 ? first : t.slice(0, 150).replace(/\s+\S*$/, "") + "…", url: abs(e.href) };
}

const json = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 1) }], structuredContent: v as Record<string, unknown> });
const fail = (s: string) => ({ content: [{ type: "text" as const, text: s }], isError: true });
const paused = () => process.env.PUBLIC_API === "off";
const PAUSED = "The open Orphic catalogue is paused for a moment. Try again later.";

function coverage(total: number, offset: number, returned: number, next: number | null) {
  const shown = returned ? `${offset + 1}-${offset + returned}` : "0";
  return next === null
    ? `Showing ${shown} of ${total}: this is every match.`
    : `Showing ${shown} of ${total}. More exist: call again with offset=${next} before concluding.`;
}

export function registerPublicTools(server: McpServer) {
  server.registerTool(
    "search_tools",
    {
      title: "Search Orphic",
      description:
        "Search Orphic's open catalogue of AI tools, skills, repos, prompts and guides found in Instagram reels, each with a checked official link. " +
        "Use for questions like 'a free tool to make video ads' or a half-remembered name (typos are fine). Every word must match the tool's name, tags, " +
        "use cases or summary; results are complete (total_matches) and best first. If nothing matches, say so: don't guess.",
      inputSchema: z.object({
        query: z.string().min(1).max(200).describe("What the user wants, or a tool's name"),
        category: z.enum(CATEGORIES).optional().describe("Optional: only this category (see list_categories)"),
        limit: z.number().int().min(1).max(30).default(10),
        offset: z.number().int().min(0).default(0),
      }),
      annotations: READ,
    },
    async ({ query, category, limit, offset }) => {
      if (paused()) return fail(PAUSED);
      const page = await searchPublic(query, category ?? "", offset, limit);
      const { entries } = await catalogueData();
      const bySlug = new Map(entries.map((e) => [e.slug, e]));
      return json({
        query,
        total_matches: page.total,
        returned: page.items.length,
        next_offset: page.nextOffset,
        coverage: coverage(page.total, offset, page.items.length, page.nextOffset),
        ...(page.total === 0 ? { note: "Nothing in the catalogue matches. Try other words, a category (list_categories), or tell the user it isn't listed yet." } : {}),
        results: page.items.map((i) => shape(bySlug.get(i.slug)!)),
      });
    },
  );

  server.registerTool(
    "get_tool",
    {
      title: "Get one tool",
      description: "Full details for one tool by its slug (from search results): link, what it does, use cases, tags, the post it was found in (credit the creator), and other tools from the same post.",
      inputSchema: z.object({ slug: z.string().min(1).max(100).describe("The tool's slug, e.g. 'timesfm'") }),
      annotations: READ,
    },
    async ({ slug }) => {
      if (paused()) return fail(PAUSED);
      const e = await catalogueEntry(slug.trim().toLowerCase());
      if (!e) return fail(`No tool with slug "${slug}". Use search_tools to find the right slug.`);
      return json({ ...shape(e.item, true), same_post: e.related.map((r) => ({ name: r.name, slug: r.slug, url: abs(r.href) })) });
    },
  );

  server.registerTool(
    "list_tools",
    {
      title: "List tools",
      description:
        "Every tool in the catalogue (or one category or kind), most saved first, one short line each: name, slug, one-line summary, link. " +
        "One call can return the whole catalogue (limit up to 500). Then use get_tool for the ones that matter. Complete: follow next_offset until it's null.",
      inputSchema: z.object({
        category: z.enum(CATEGORIES).optional(),
        kind: z.enum(ENTITY_KINDS).optional(),
        limit: z.number().int().min(1).max(500).default(50),
        offset: z.number().int().min(0).default(0),
      }),
      annotations: READ,
    },
    async ({ category, kind, limit, offset }) => {
      if (paused()) return fail(PAUSED);
      const { entries } = await catalogueData();
      const all = entries.filter((e) => (!category || e.category === category) && (!kind || e.kind === kind));
      const items = all.slice(offset, offset + limit);
      const next = offset + items.length < all.length ? offset + items.length : null;
      return json({
        total_matches: all.length,
        returned: items.length,
        next_offset: next,
        coverage: coverage(all.length, offset, items.length, next),
        results: items.map(brief),
      });
    },
  );

  server.registerTool(
    "list_categories",
    {
      title: "What's in Orphic",
      description: "The catalogue's categories and kinds with counts, and the total. Use it before filtering, or before telling the user something isn't listed.",
      inputSchema: z.object({}),
      annotations: READ,
    },
    async () => {
      if (paused()) return fail(PAUSED);
      const { entries } = await catalogueData();
      const count = (key: (e: CatalogueEntry) => string) => {
        const m = new Map<string, number>();
        for (const e of entries) m.set(key(e), (m.get(key(e)) ?? 0) + 1);
        return [...m].map(([value, n]) => ({ value, count: n })).sort((a, b) => b.count - a.count);
      };
      return json({
        total_tools: entries.length,
        categories: count((e) => e.category),
        kinds: count((e) => e.kind),
        browse: abs("/explore"),
        for_agents: { start_here: abs("/llms.txt"), overview: abs("/explore.md"), everything_markdown: abs("/llms-full.txt"), everything_json: abs("/catalogue.json") },
      });
    },
  );
}
