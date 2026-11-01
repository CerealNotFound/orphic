// "Agent mode": the team's library as clean Markdown, for AI agents to read or grep in one request.
import { q } from "./db";
import { searchEntities, type EntityFilters } from "./search";
import { entityUrl } from "./telegram/cards";
import { env } from "./env";
import { catalogueData } from "./public-catalogue";

type Row = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  canonical_url: string | null;
  link_status: string;
  summary: string;
  use_cases: string[];
  category: string;
  tags: string[];
  search_terms: string[];
  aliases: string[];
  pricing: string | null;
  creator_handle: string | null;
  is_creator_owned: boolean;
  save_count: number;
  rating_score: number;
  created_at: string;
  updated_at: string;
  savers: string[];
  sources: { url: string | null; kind: string; creator: string | null; summary: string | null }[];
  copies: { id: string; filename: string; kind: string; size: number }[];
};

const LINK_LABEL: Record<string, string> = {
  verified: "verified",
  unverified: "unverified",
  pending_dm: "waiting on the creator's DM",
  saved: "no public link; the content is saved in Orphic (see Saved copies)",
  unavailable: "creator's DM never came (no link)",
  none: "no link",
};

const CATEGORY_TITLE = (c: string) => c.split("-").map((w) => (w === "ai" ? "AI" : w[0].toUpperCase() + w.slice(1))).join(" ");

async function loadRows(workspaceId: string, ids: string[] | null, f: EntityFilters = {}): Promise<Row[]> {
  const params: unknown[] = [workspaceId];
  const where: string[] = ["e.workspace_id = $1"];
  if (ids) {
    params.push(ids);
    where.push(`e.id = any($${params.length})`);
  }
  if (f.category) {
    params.push(f.category);
    where.push(`e.category = $${params.length}`);
  }
  if (f.tag) {
    params.push(f.tag);
    where.push(`$${params.length} = any(e.tags)`);
  }
  if (f.kind) {
    params.push(f.kind);
    where.push(`e.kind = $${params.length}`);
  }
  return q<Row>(
    `select e.id, e.name, e.slug, e.kind, e.canonical_url, e.link_status, e.summary, e.use_cases, e.category, e.tags, e.search_terms,
            e.aliases, e.pricing, e.creator_handle, e.is_creator_owned, e.save_count, e.rating_score, e.created_at, e.updated_at,
            coalesce((select array_agg(distinct m.display_name) from capture_entities ce join saves s on s.capture_id = ce.capture_id
                      join members m on m.id = s.member_id where ce.entity_id = e.id), '{}') as savers,
            coalesce((select json_agg(json_build_object('url', c.source_url, 'kind', c.kind, 'creator', c.creator_handle, 'summary', c.summary) order by c.created_at)
                      from capture_entities ce join captures c on c.id = ce.capture_id where ce.entity_id = e.id), '[]') as sources,
            coalesce((select json_agg(json_build_object('id', sn.id, 'filename', sn.filename, 'kind', sn.kind, 'size', sn.size_bytes) order by sn.created_at)
                      from capture_entities ce join snapshots sn on sn.capture_id = ce.capture_id and sn.complete where ce.entity_id = e.id), '[]') as copies
     from entities e where ${where.join(" and ")}
     order by e.category, e.save_count desc, e.rating_score desc, e.name`,
    params,
  );
}

function itemMd(r: Row, level = 3, extra: { copy?: string; loose?: boolean } = {}): string {
  const h = "#".repeat(level);
  const lines = [`${h} ${r.name}`, ""];
  const facts: [string, string | null][] = [
    ["Type", r.kind],
    ["Match", extra.loose ? "only similar in meaning (no word or name matched): a suggestion, not an answer" : null],
    // Drive, Docs and Notion links can be taken down by their owner: give our saved copy first.
    ["Link", extra.copy ? `${extra.copy} (saved copy; original: ${r.canonical_url})` : r.canonical_url ? `${r.canonical_url} (${LINK_LABEL[r.link_status] ?? r.link_status})` : LINK_LABEL[r.link_status] ?? r.link_status],
    ["Category", r.category],
    ["Pricing", r.pricing],
    ["Creator", r.creator_handle ? `@${r.creator_handle}${r.is_creator_owned ? " (creator's own resource)" : ""}` : null],
    ["Tags", r.tags.length ? r.tags.join(", ") : null],
    ["Also known as", r.aliases.length ? r.aliases.join(", ") : null],
    ["Saved by", r.savers.length ? `${r.savers.join(", ")} (${r.save_count} ${r.save_count === 1 ? "save" : "saves"})` : null],
    ["Team rating", r.rating_score ? `${r.rating_score > 0 ? "+" : ""}${r.rating_score}` : null],
    ["Orphic page", entityUrl(r.slug)],
    ["Id", r.id],
  ];
  for (const [k, v] of facts) if (v) lines.push(`- **${k}:** ${v}`);
  lines.push("", r.summary);
  if (r.use_cases.length) lines.push("", "**Use it to:**", ...r.use_cases.map((u) => `- ${u}`));
  if (r.search_terms.length) lines.push("", `**Related terms:** ${r.search_terms.join(", ")}`);
  const src = r.sources.filter((s) => s.url);
  if (src.length) lines.push("", "**Sources:**", ...src.map((s) => `- ${s.url}${s.creator ? ` (@${s.creator})` : ""}${s.summary ? `: ${s.summary}` : ""}`));
  if (r.copies.length)
    lines.push(
      "",
      "**Saved copies (private; same API key):**",
      ...r.copies.map((c) => `- ${c.kind === "text" ? "Text" : "File"}: [${c.filename}](${env.APP_URL}/api/snapshots/${c.id}) (${Math.max(1, Math.round(c.size / 1024))} KB)`),
    );
  return lines.join("\n");
}

/** One line per item: enough for an agent to choose, with what to call for the rest. */
function briefMd(r: Row, extra: { copy?: string; loose?: boolean } = {}) {
  const t = r.summary.replace(/\s+/g, " ").trim();
  const first = t.split(/(?<=[.!?])\s/)[0];
  const sum = first.length <= 150 ? first : t.slice(0, 150).replace(/\s+\S*$/, "") + "…";
  const link = extra.copy ?? r.canonical_url ?? LINK_LABEL[r.link_status] ?? r.link_status;
  return `- **${r.name}** (${r.kind}${extra.loose ? "; only similar in meaning" : ""}): ${sum} · ${link} · \`${r.slug}\``;
}
const approxTokens = (chars: number) => (chars < 4000 ? "under 1k tokens" : `about ${Math.round(chars / 4000)}k tokens`);

/**
 * The library (or a search, or one item) as Markdown for agents.
 * detail "brief" (default): one line per item, plus the size of the full version, so the agent can read the list,
 * then fetch only the items it needs (item=<slug>) or everything in full (detail "full") when that's worth it.
 */
export async function libraryMarkdown(
  workspaceId: string,
  opts: EntityFilters & { q?: string; item?: string; detail?: "brief" | "full" } = {},
): Promise<{ markdown: string; count: number }> {
  const full = opts.detail === "full";
  const cat = await catalogueData();
  const copies = new Map(cat.workspaceId === workspaceId ? cat.entries.filter((e) => e.href !== e.url).map((e) => [e.slug, `${env.APP_URL}${e.href}`]) : []);
  if (opts.item) {
    const rows = (await loadRows(workspaceId, null)).filter((r) => r.slug === opts.item || r.id === opts.item);
    if (!rows.length) return { markdown: `# Not found\n\nNo item with slug or id \`${opts.item}\`.\n`, count: 0 };
    return { markdown: itemMd(rows[0], 1, { copy: copies.get(rows[0].slug) }) + "\n", count: 1 };
  }

  let rows: Row[];
  let heading: string;
  const loose = new Set<string>(); // search results that only matched by meaning
  if (opts.q?.trim()) {
    // Every match, ranked: page through the whole result set.
    const ids: string[] = [];
    for (let offset = 0; ; offset += 50) {
      const page = await searchEntities(workspaceId, opts.q, { ...opts, limit: 50, offset });
      ids.push(...page.items.map((i) => i.id));
      for (const i of page.items) if (i.matched_by && !i.matched_by.some((m) => m !== "meaning")) loose.add(i.id);
      if (page.next_offset === null) break;
    }
    const byId = new Map((await loadRows(workspaceId, ids)).map((r) => [r.id, r]));
    rows = ids.map((id) => byId.get(id)!).filter(Boolean);
    heading = `Orphic: results for "${opts.q.trim()}"`;
  } else {
    rows = await loadRows(workspaceId, null, opts);
    heading = "Orphic: the team's library";
  }

  const out = [
    `# ${heading}`,
    "",
    `${rows.length} ${rows.length === 1 ? "item" : "items"}${opts.q ? ", best matches first" : ", grouped by category"}. This is the complete list${opts.q ? " of matches" : ""}, not a sample.` +
      (loose.size === rows.length && rows.length
        ? " None of them match these words or a name: they're only loosely related in meaning, so treat them as suggestions and say so."
        : loose.size
          ? ` The last ${loose.size} only match by meaning (marked "Match: only similar in meaning").`
          : ""),
    `Generated ${new Date().toISOString()}. Link status "verified" means the link was checked against the official site.`,
    "",
  ];
  const fullChars = full ? 0 : rows.reduce((n, r) => n + itemMd(r, 3, { copy: copies.get(r.slug) }).length, 0);
  if (!full && rows.length)
    out.push(
      `This is the short list: one line per item (name, what it is, link, slug). For one item in full, ask for item=<slug>. ` +
        `All ${rows.length} in full would be ${approxTokens(fullChars)} (detail=full); only worth it if you need every detail.`,
      "",
    );
  if (!full && opts.q?.trim()) {
    rows.forEach((r) => out.push(briefMd(r, { copy: copies.get(r.slug), loose: loose.has(r.id) })));
  } else if (!full) {
    const groups = new Map<string, Row[]>();
    for (const r of rows) groups.set(r.category, [...(groups.get(r.category) ?? []), r]);
    for (const [c, rs] of groups) out.push(`## ${CATEGORY_TITLE(c)} (${rs.length})`, "", ...rs.map((r) => briefMd(r, { copy: copies.get(r.slug) })), "");
  } else if (opts.q?.trim()) {
    rows.forEach((r) => out.push(itemMd(r, 2, { copy: copies.get(r.slug), loose: loose.has(r.id) }), "", "---", ""));
  } else {
    const groups = new Map<string, Row[]>();
    for (const r of rows) groups.set(r.category, [...(groups.get(r.category) ?? []), r]);
    out.push("## Contents", "", ...[...groups].map(([c, rs]) => `- ${CATEGORY_TITLE(c)} (${rs.length})`), "");
    for (const [c, rs] of groups) {
      out.push(`## ${CATEGORY_TITLE(c)}`, "");
      rs.forEach((r) => out.push(itemMd(r, 3, { copy: copies.get(r.slug) }), ""));
    }
  }
  return { markdown: out.join("\n").trimEnd() + "\n", count: rows.length };
}
