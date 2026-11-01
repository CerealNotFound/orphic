// The open catalogue. ONE cached database query (catalogueData) feeds every public page and endpoint: the landing
// page, /explore, every tool page, the REST API, the sitemap, llms-full.txt and structured data. Everything else is
// derived from it in memory. Public pages are prerendered, so even that query runs only at build or hourly refresh.
// Reads only the `public_items` view (db/migrations/013) and always filters by workspace.
import { cacheLife, cacheTag } from "next/cache";
import { buildIndex, searchCatalogue, type SearchIndex } from "./catalogue-search";
import { CATEGORIES } from "./contracts";
import { q1 } from "./db";
import { env } from "./env";
import { PLATFORM, PUBLIC_WS_SQL, publicWsParam, REVOCABLE, REVOCABLE_SQL, SOCIAL, SOCIAL_SQL } from "./public-links";

/** One catalogue entry, with everything its row, details and page need. Sent to the browser as is. */
export type CatalogueEntry = {
  slug: string;
  name: string;
  url: string;
  domain: string | null;
  summary: string;
  category: string;
  kind: string;
  tags: string[];
  useCases: string[];
  sources: { platform: string; creator: string | null; url: string; date: string }[];
  related: string[]; // slugs of tools shown in the same post
  firstSeen: string;
  saves: number;
  files: boolean; // we keep a public saved copy (see public-files.ts)
  href: string; // what a click on the name opens: our saved copy for links that can be taken down, else the official link
};

/** Server-only extras (never sent to the browser). */
type EntryMeta = { id: string; keyword: string | null; fromReel: boolean; updatedAt: string };

export type CatalogueData = {
  workspaceId: string | null;
  entries: CatalogueEntry[];
  meta: Record<string, EntryMeta>; // by slug
  stats: { reels: number; commentReels: number; commentSolved: number };
};

type Row = {
  ws: string | null;
  reels: string;
  comment_reels: string;
  comment_solved: string;
  items: {
    id: string;
    slug: string;
    name: string;
    url: string;
    domain: string | null;
    summary: string;
    category: string;
    kind: string;
    tags: string[] | null;
    use_cases: string[] | null;
    created_at: string;
    updated_at: string;
    save_count: number;
    sources: { creator: string | null; url: string; date: string }[];
    related: string[];
    files: boolean;
    keyword: string | null;
    from_reel: boolean;
  }[];
};

const CATALOGUE_SQL = `
with ws as (select ${PUBLIC_WS_SQL} as id),
items as (select p.* from public_items p join ws on p.workspace_id = ws.id),
reel as (
  select c.id,
    exists (select 1 from jobs j, jsonb_array_elements(j.result->'entities') x
             where j.capture_id = c.id and j.workspace_id = c.workspace_id and coalesce(x->>'comment_keyword', '') <> '') as gated,
    exists (select 1 from capture_entities ce join entities e on e.id = ce.entity_id and e.workspace_id = c.workspace_id
             where ce.capture_id = c.id and ce.role = 'primary' and e.link_status = 'verified') as solved
  from captures c join ws on c.workspace_id = ws.id
  where c.kind = 'reel'
)
select (select id from ws) as ws,
  (select count(*) from reel) as reels,
  (select count(*) from reel where gated) as comment_reels,
  (select count(*) from reel where gated and solved) as comment_solved,
  coalesce((select json_agg(t order by t.save_count desc, t.updated_at desc, t.slug) from (
    select i.id, i.slug, i.name, i.url, i.domain, i.summary, i.category, i.kind, i.tags, i.use_cases,
      i.created_at, i.updated_at, i.save_count,
      (select coalesce(json_agg(json_build_object('creator', c.creator_handle, 'url', c.source_url, 'date', c.created_at) order by c.created_at), '[]')
         from capture_entities ce join captures c on c.id = ce.capture_id and c.workspace_id = i.workspace_id
        where ce.entity_id = i.id and c.kind = 'reel' and c.source_url is not null) as sources,
      (select coalesce(array_agg(distinct p2.slug), '{}')
         from capture_entities a
         join capture_entities b on b.capture_id = a.capture_id and b.entity_id <> a.entity_id
         join items p2 on p2.id = b.entity_id
        where a.entity_id = i.id) as related,
      (i.url ~* ${REVOCABLE_SQL} and exists (
         select 1 from snapshots s join capture_entities ce on ce.capture_id = s.capture_id
          where ce.entity_id = i.id and s.workspace_id = i.workspace_id and s.complete
            and s.source_url is not null and s.source_url !~* ${SOCIAL_SQL})) as files,
      -- the "comment X" keyword of a reel where this was the main item (never a tool merely mentioned in it)
      (select upper(x->>'comment_keyword')
         from capture_entities ce
         join captures c on c.id = ce.capture_id and c.kind = 'reel' and c.workspace_id = i.workspace_id
         join jobs j on j.capture_id = c.id, jsonb_array_elements(j.result->'entities') x
        where ce.entity_id = i.id and ce.role = 'primary' and x->>'role' = 'primary' and coalesce(x->>'comment_keyword', '') <> ''
        limit 1) as keyword,
      exists (select 1 from capture_entities ce join captures c on c.id = ce.capture_id and c.workspace_id = i.workspace_id
               where ce.entity_id = i.id and ce.role = 'primary' and c.kind = 'reel') as from_reel
    from items i) t), '[]') as items`;

export async function catalogueData(): Promise<CatalogueData> {
  "use cache";
  cacheLife("hours");
  cacheTag("public-catalogue");
  const empty: CatalogueData = { workspaceId: null, entries: [], meta: {}, stats: { reels: 0, commentReels: 0, commentSolved: 0 } };
  let row: Row | null;
  try {
    row = await q1<Row>(CATALOGUE_SQL, [publicWsParam()]);
  } catch (err) {
    console.error("catalogue unavailable", err);
    return empty;
  }
  if (!row?.ws) return empty;
  const entries: CatalogueEntry[] = [];
  const meta: Record<string, EntryMeta> = {};
  for (const i of row.items) {
    const sources: CatalogueEntry["sources"] = [];
    for (const s of i.sources) {
      if (!SOCIAL.test(s.url)) continue;
      const url = s.url.split("?")[0];
      if (sources.some((x) => x.url === url)) continue;
      sources.push({ platform: PLATFORM.find(([re]) => re.test(url))?.[1] ?? "Post", creator: s.creator, url, date: new Date(s.date).toISOString() });
    }
    entries.push({
      slug: i.slug,
      name: i.name,
      url: i.url,
      domain: i.domain,
      summary: i.summary,
      category: i.category,
      kind: i.kind,
      tags: i.tags ?? [],
      useCases: i.use_cases ?? [],
      sources,
      related: i.related ?? [],
      firstSeen: new Date(i.created_at).toISOString(),
      saves: Number(i.save_count) || 0,
      files: i.files,
      href: i.files && REVOCABLE.test(i.url) ? `/explore/${i.slug}/files` : i.url,
    });
    meta[i.slug] = { id: i.id, keyword: i.keyword, fromReel: i.from_reel, updatedAt: new Date(i.updated_at).toISOString() };
  }
  return {
    workspaceId: row.ws,
    entries,
    meta,
    stats: { reels: Number(row.reels) || 0, commentReels: Number(row.comment_reels) || 0, commentSolved: Number(row.comment_solved) || 0 },
  };
}

export async function catalogueIndex(): Promise<CatalogueEntry[]> {
  return (await catalogueData()).entries;
}

/** One entry with what its page needs. No database work: it comes from the cached catalogue. */
export async function catalogueEntry(slug: string) {
  const { entries } = await catalogueData();
  const item = entries.find((e) => e.slug === slug);
  if (!item) return null;
  const bySlug = new Map(entries.map((e) => [e.slug, e]));
  const related = item.related
    .map((s) => bySlug.get(s))
    .filter((r): r is CatalogueEntry => !!r)
    .sort((a, b) => a.name.localeCompare(b.name));
  const more = entries.filter((e) => e.category === item.category && e.slug !== item.slug).slice(0, 6);
  return { item, related, more };
}

export async function publicSlugs(): Promise<string[]> {
  return (await catalogueData()).entries.map((e) => e.slug);
}

/** Every entry for llms-full.txt and structured data, by category then name. */
export async function allPublicItems() {
  const { entries, meta } = await catalogueData();
  return entries
    .map((e) => ({ ...e, updatedAt: meta[e.slug]?.updatedAt ?? e.firstSeen }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.slug.localeCompare(b.slug));
}

// ---------- REST API: the same search the website runs, over the same cached data ----------

/** `url` is the official link, or our saved copy for Drive/Docs/Notion links (then `original_url` is the original). */
export type PublicItem = { slug: string; name: string; url: string; original_url?: string; domain: string | null; summary: string; category: string; kind: string };
export type PublicPage = { items: PublicItem[]; total: number; offset: number; nextOffset: number | null };
export type PublicDetail = PublicItem & {
  tags: string[];
  useCases: string[];
  saves: number;
  firstSeen: string;
  sources: CatalogueEntry["sources"];
  related: PublicItem[];
};

export const PUBLIC_PAGE_SIZE = 24;
const MAX_LIMIT = 48;
const MAX_OFFSET = 5000;

const toItem = (e: CatalogueEntry): PublicItem => ({
  slug: e.slug,
  name: e.name,
  url: e.href === e.url ? e.url : `${env.APP_URL}${e.href}`,
  ...(e.href === e.url ? {} : { original_url: e.url }),
  domain: e.domain,
  summary: e.summary,
  category: e.category,
  kind: e.kind,
});

// The search index is rebuilt only when the cached catalogue changes.
let indexFor: CatalogueEntry[] | null = null;
let index: SearchIndex = [];

export function cleanSearch(input: { q?: string | null; category?: string | null; offset?: string | number | null; limit?: string | number | null }) {
  const text = (input.q ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const category = input.category && (CATEGORIES as readonly string[]).includes(input.category) ? input.category : "";
  const offset = Math.min(Math.max(0, Math.floor(Number(input.offset) || 0)), MAX_OFFSET);
  const limit = Math.min(Math.max(1, Math.floor(Number(input.limit) || PUBLIC_PAGE_SIZE)), MAX_LIMIT);
  return { text, category, offset, limit };
}

export async function searchPublic(text: string, category: string, offset: number, limit: number): Promise<PublicPage> {
  const { entries } = await catalogueData();
  if (indexFor !== entries) {
    index = buildIndex(entries);
    indexFor = entries;
  }
  const all = searchCatalogue(index, text, category);
  const items = all.slice(offset, offset + limit).map(toItem);
  const next = offset + items.length;
  return { items, total: all.length, offset, nextOffset: next < all.length ? next : null };
}

export async function getPublicItem(slug: string): Promise<PublicDetail | null> {
  const e = await catalogueEntry(slug);
  if (!e) return null;
  const { item } = e;
  return {
    ...toItem(item),
    tags: item.tags,
    useCases: item.useCases,
    saves: item.saves,
    firstSeen: item.firstSeen,
    sources: item.sources,
    related: e.related.map(toItem),
  };
}

// ---------- workspace id for routes that need it on its own (saved copies) ----------
export async function publicWorkspaceId(): Promise<string | null> {
  return (await catalogueData()).workspaceId;
}
