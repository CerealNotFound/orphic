// Agent pages: the open catalogue as plain Markdown, laid out as a map an agent can walk.
//
//   /llms.txt                       layer 0: what Orphic is, every way in, and what each path costs
//   /explore.md                     layer 1: categories with counts and their top tools
//   /explore/category/<c>.md        layer 2: every tool in a category, one line each
//   /explore/{slug}.md              layer 3: one tool in full, with links sideways (same post, same category, files)
//   /llms-full.txt, /catalogue.json everything in one request (Markdown or JSON)
//
// Every page says how big the next step is (in tokens), so an agent can choose the cheapest route or ask its user.
// All of it comes from the cached catalogue (catalogueData) and is prerendered: no database work per request.
import { CATEGORIES } from "./contracts";
import { env } from "./env";
import { catalogueData, type CatalogueEntry } from "./public-catalogue";
import { publicCopy, publicFileUrl } from "./public-files";

export const MD_HEADERS = {
  "content-type": "text/markdown; charset=utf-8",
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  "x-robots-tag": "noindex", // for agents, not search results (the HTML pages are the ones to index)
};
export const md = (body: string) => new Response(body, { headers: MD_HEADERS });

const abs = (p: string) => (p.startsWith("http") ? p : `${env.APP_URL}${p}`);
/** Rough token count (about 4 characters per token), shown so agents can budget. */
export const tokens = (chars: number) => (chars < 1000 ? "<1k tokens" : `~${Math.round(chars / 4000)}k tokens`.replace("~0k", "~1k"));
const one = (s: string, n = 140) => {
  const t = s.replace(/\s+/g, " ").trim();
  const first = t.split(/(?<=[.!?])\s/)[0];
  const cut = first.length <= n ? first : t.slice(0, n).replace(/\s+\S*$/, "") + "…";
  return cut;
};
const ACR = new Set(["ai", "ui", "mcp", "api", "seo", "llm", "crm"]);
export const catTitle = (c: string) =>
  c
    .split("-")
    .map((w, i) => (ACR.has(w) ? w.toUpperCase() : i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
const toolMdUrl = (slug: string) => abs(`/explore/${slug}.md`);
const catMdUrl = (c: string) => abs(`/explore/category/${c}.md`);
/** The link to open: our saved copy for Drive/Docs/Notion (the owner can take those down), else the official link. */
const openUrl = (e: CatalogueEntry) => abs(e.href);
const linkLine = (e: CatalogueEntry) => (e.href === e.url ? e.url : `${abs(e.href)} (saved copy; original ${e.url})`);

const READABLE = /markdown|text\/plain|pdf|html|wordprocessing|msword|csv|rtf|opendocument\.text/;
const fileLabel = (t: string) =>
  [
    [/markdown/, "Markdown"], [/text\/plain/, "Text"], [/pdf/, "PDF"], [/html/, "Web page"], [/wordprocessing|msword/, "Word doc"],
    [/spreadsheet|excel|csv/, "Spreadsheet"], [/presentation|powerpoint/, "Slides"], [/^audio\//, "Audio"], [/^video\//, "Video"], [/^image\//, "Image"],
  ].find(([re]) => (re as RegExp).test(t))?.[1] as string ?? "File";

function byCategory(entries: CatalogueEntry[]) {
  const m = new Map<string, CatalogueEntry[]>();
  for (const e of entries) m.set(e.category, [...(m.get(e.category) ?? []), e]);
  return [...m].sort((a, b) => b[1].length - a[1].length);
}

/** One line per tool: enough to choose, with the link to open and the link to read more. */
function briefLine(e: CatalogueEntry) {
  return `- [${e.name}](${toolMdUrl(e.slug)}): ${one(e.summary)} · ${e.kind} · ${openUrl(e)}`;
}

// ---------- layer 2: a category ----------
export async function categoryMd(category: string): Promise<string | null> {
  const { entries } = await catalogueData();
  const list = entries.filter((e) => e.category === category);
  if (!list.length) return null;
  const lines = list.map(briefLine);
  const fullChars = list.reduce((n, e) => n + toolBody(e).length, 0);
  return [
    `# ${catTitle(category)} · Orphic`,
    "",
    `> ${list.length} tools, most saved first. One line each: name (links to its full page), what it is, type, and the link to open.`,
    "",
    `Go deeper: open a tool's page for use cases, tags, credit and related tools (each under 1k tokens). All ${list.length} in full: ${tokens(fullChars)}; or fetch ${abs("/llms-full.txt")} for every category at once.`,
    `Up: [All categories](${abs("/explore.md")}) · [Start here](${abs("/llms.txt")})`,
    "",
    ...lines,
    "",
  ].join("\n");
}

// ---------- layer 3: one tool ----------
function toolBody(e: CatalogueEntry) {
  const out = [`# ${e.name}`, "", `> ${e.summary}`, "", `- **Open:** ${linkLine(e)}`, `- **Type:** ${e.kind} · **Category:** [${catTitle(e.category)}](${catMdUrl(e.category)})`];
  if (e.tags.length) out.push(`- **Tags:** ${e.tags.join(", ")}`);
  out.push(`- **First found:** ${e.firstSeen.slice(0, 10)} · **Web page:** ${abs(`/explore/${e.slug}`)}`);
  if (e.useCases.length) out.push("", "## Use it to", "", ...e.useCases.map((u) => `- ${u}`));
  if (e.sources.length)
    out.push("", "## Found in (credit the creator)", "", ...e.sources.map((s) => `- ${s.platform} post${s.creator ? ` by @${s.creator.replace(/^@/, "")}` : ""}: ${s.url} (${s.date.slice(0, 10)})`));
  return out.join("\n");
}

export async function toolMd(slug: string): Promise<string | null> {
  const { entries } = await catalogueData();
  const e = entries.find((x) => x.slug === slug);
  if (!e) return null;
  const bySlug = new Map(entries.map((x) => [x.slug, x]));
  const out = [toolBody(e)];

  // A saved copy (Drive folder, Doc, Notion page): readable files first (cheapest for an agent), then media.
  if (e.files) {
    const copy = await publicCopy(e.slug);
    if (copy) {
      const files = copy.files.filter((f) => !(f.kind === "text" && f.source && /\/drive\/folders\//.test(f.source)));
      const readable = files.filter((f) => READABLE.test(f.type));
      const media = files.filter((f) => !READABLE.test(f.type));
      const folders = new Map<string, number>();
      for (const f of files) if (f.name.includes("/")) folders.set(f.name.split("/")[0], (folders.get(f.name.split("/")[0]) ?? 0) + 1);
      out.push("", `## Saved files (${files.length})`, "", `Every file, in folders, with players and downloads: ${abs(`/explore/${e.slug}/files`)}.`);
      if (folders.size > 1) out.push(`Folders: ${[...folders].map(([n, c]) => `${n} (${c})`).join(", ")}.`);
      out.push("");
      const show = [...readable, ...media].slice(0, 40);
      for (const f of show) out.push(`- ${f.name} · ${fileLabel(f.type)}, ${Math.max(1, Math.round(f.size / 1024))} KB · ${abs(publicFileUrl(f.id))}`);
      if (files.length > show.length) out.push(`- …and ${files.length - show.length} more (${media.length} are media) on the files page.`);
    }
  }
  const related = e.related.map((s) => bySlug.get(s)).filter((r): r is CatalogueEntry => !!r);
  if (related.length) out.push("", "## From the same post", "", ...related.map(briefLine));
  const more = entries.filter((x) => x.category === e.category && x.slug !== e.slug).slice(0, 5);
  if (more.length) out.push("", `## More in ${catTitle(e.category)}`, "", ...more.map(briefLine), `- All of them: ${catMdUrl(e.category)}`);
  out.push("", `Up: [${catTitle(e.category)}](${catMdUrl(e.category)}) · [All categories](${abs("/explore.md")}) · [Start here](${abs("/llms.txt")})`, "");
  return out.join("\n");
}

// ---------- layer 1: overview ----------
export async function overviewMd(): Promise<string> {
  const { entries } = await catalogueData();
  const groups = byCategory(entries);
  const out = [
    "# Orphic catalogue: overview",
    "",
    `> ${entries.length} AI tools, skills, repos, prompts and guides found in Instagram reels, each with a checked link. ${groups.length} categories below.`,
    "",
    "Each category page lists its tools one line each; each tool has a full page. Pick the narrowest path that answers the question.",
    "",
    "| Category | Tools | Page size | Top tools |",
    "|---|---|---|---|",
  ];
  for (const [c, list] of groups) {
    const chars = list.reduce((n, e) => n + briefLine(e).length, 0) + 400;
    out.push(`| [${catTitle(c)}](${catMdUrl(c)}) | ${list.length} | ${tokens(chars)} | ${list.slice(0, 3).map((e) => `[${e.name}](${toolMdUrl(e.slug)})`).join(", ")} |`);
  }
  const allBrief = entries.reduce((n, e) => n + briefLine(e).length, 0);
  const allFull = entries.reduce((n, e) => n + toolBody(e).length, 0);
  out.push(
    "",
    "## Other ways in",
    "",
    `- Search instead of browsing: ${abs("/api/public/search?q=video+ads")} (JSON), or the MCP server ${abs("/api/public/mcp")} (tool \`search_tools\`).`,
    `- Every tool, one line each: all category pages together come to ${tokens(allBrief)}.`,
    `- Every tool in full, one request: ${abs("/llms-full.txt")} (${tokens(allFull)}) or ${abs("/catalogue.json")} (same data as JSON, for code).`,
    "",
    `Up: [Start here](${abs("/llms.txt")})`,
    "",
  );
  return out.join("\n");
}

// ---------- everything ----------
export async function fullMd(): Promise<string> {
  const { entries } = await catalogueData();
  const out = [
    "# Orphic catalogue (full)",
    "",
    `> All ${entries.length} tools with full details, grouped by category (largest first). Licence: CC BY 4.0, credit Orphic (${env.APP_URL}). Smaller entry points: ${abs("/llms.txt")}.`,
    "",
  ];
  for (const [c, list] of byCategory(entries)) {
    out.push(`## ${catTitle(c)} (${list.length})`, "");
    for (const e of list) out.push(toolBody(e).replace(/^# /, "### ").replace(/\n## /g, "\n#### "), "");
  }
  return out.join("\n");
}

export async function catalogueJson() {
  const { entries } = await catalogueData();
  return {
    name: "Orphic catalogue",
    licence: "CC BY 4.0 (credit Orphic)",
    source: env.APP_URL,
    total: entries.length,
    categories: byCategory(entries).map(([c, l]) => ({ value: c, title: catTitle(c), count: l.length })),
    tools: entries.map((e) => ({
      slug: e.slug,
      name: e.name,
      kind: e.kind,
      category: e.category,
      summary: e.summary,
      url: openUrl(e),
      ...(e.href === e.url ? {} : { original_url: e.url }),
      page: abs(`/explore/${e.slug}`),
      markdown: toolMdUrl(e.slug),
      use_cases: e.useCases,
      tags: e.tags,
      found_in: e.sources.map((s) => ({ platform: s.platform, creator: s.creator, url: s.url, date: s.date.slice(0, 10) })),
      same_post: e.related,
      first_seen: e.firstSeen.slice(0, 10),
    })),
  };
}

// ---------- layer 0: start here ----------
export async function indexMd(): Promise<string> {
  const { entries } = await catalogueData();
  const groups = byCategory(entries);
  const overviewChars = (await overviewMd()).length;
  const fullChars = (await fullMd()).length;
  const jsonChars = JSON.stringify(await catalogueJson()).length;
  const base = env.APP_URL;
  return `# Orphic

> A free, open catalogue of ${entries.length} AI tools, skills, repos, prompts and guides found in Instagram reels. Every item has a checked official link and a plain-English summary. No login, no API key, nothing blocked.

## Pick a path (cheapest first)

| You want to… | Use | Size |
|---|---|---|
| Answer a specific question ("a tool for video ads") | MCP \`search_tools\` at ${base}/api/public/mcp, or ${base}/api/public/search?q=video+ads | <1k tokens per call |
| Look up one tool you already know | ${base}/explore/{slug}.md (or MCP \`get_tool\`) | <1k tokens |
| See what exists, then decide | ${base}/explore.md (categories, counts, top tools) | ${tokens(overviewChars)} |
| List one category | ${base}/explore/category/{category}.md, one line per tool | 1-5k tokens |
| Read everything in full | ${base}/llms-full.txt | ${tokens(fullChars)} |
| Load everything into code | ${base}/catalogue.json | ${tokens(jsonChars)} |

If the user's request is broad and the full catalogue is more than you need, start with the overview and ask them which area matters, rather than loading everything.

## Categories

${groups.map(([c, l]) => `- [${catTitle(c)}](${catMdUrl(c)}): ${l.length}`).join("\n")}

## MCP server (for AI assistants)

- URL: ${base}/api/public/mcp (Streamable HTTP, no key). Claude Code: \`claude mcp add --transport http orphic ${base}/api/public/mcp\`
- Tools: \`search_tools\` (question → complete, ranked matches), \`get_tool\` (one tool in full), \`list_tools\` (browse a category or everything; one call can return all ${entries.length}), \`list_categories\` (overview).

## Search API (for scripts)

- \`GET ${base}/api/public/search?q=…&category=…&offset=…&limit=…\` → \`{ query, items, total, offset, nextOffset }\`. Every meaningful word must match; typos in names are fine. \`total\` is complete; page with \`nextOffset\` until it's null. Max \`limit\` 48.
- Categories: ${CATEGORIES.join(", ")}.
- Spec: ${base}/api/public/openapi.json. CORS open. No auth.

## Links

Each item's link is its checked official site. For Google Drive, Docs and Notion links (their owner can take them down) Orphic gives its own saved copy instead, with the original alongside; the files are downloadable at the copy's link.

## Licence and manners

- Code: MIT (https://github.com/cerealnotfound/orphic). Catalogue text: CC BY 4.0, credit "Orphic" with a link to ${base}. Names and links belong to their owners; credit the creator a tool was found through.
- Everything here is cached and cheap to serve: fetch what you need. The catalogue changes a few times a day.
`;
}
