// Public-safe data for the landing page: our own text, facts and official links, derived from the cached catalogue
// (see catalogueData). Never creators' captions or transcripts, never teammates.
import { buildIndex, searchCatalogue } from "./catalogue-search";
import { catalogueData } from "./public-catalogue";

export type LandingItem = {
  name: string;
  slug: string;
  url: string;
  domain: string | null;
  summary: string;
  category: string;
  kind: string;
  tags: string[];
  useCases: string[];
  keyword: string | null;
  creator: string | null;
};

export type LandingData = {
  items: LandingItem[];
  heroExamples: LandingItem[];
  keywords: string[];
  stats: {
    tools: number;
    reels: number;
    commentReels: number;
    commentSolved: number;
    categories: { value: string; count: number }[];
  };
};

/** Landing page data, derived from the cached catalogue: no database work of its own. */
export async function getLandingData(): Promise<LandingData> {
  const { entries, meta, stats } = await catalogueData();
  const items: LandingItem[] = entries.map((e) => ({
    name: e.name,
    slug: e.slug,
    url: e.url,
    domain: e.domain,
    summary: e.summary,
    category: e.category,
    kind: e.kind,
    tags: e.tags,
    useCases: e.useCases,
    keyword: meta[e.slug]?.keyword ?? null,
    creator: e.sources[0]?.creator ?? null,
  }));
  const cats = new Map<string, number>();
  for (const i of items) cats.set(i.category, (cats.get(i.category) ?? 0) + 1);
  const keywords = [...new Set(items.map((i) => i.keyword).filter((k): k is string => Boolean(k && /^[A-Z0-9]{3,12}$/.test(k))))];
  const heroExamples = items.filter((i) => i.keyword && meta[i.slug]?.fromReel && i.useCases.length).slice(0, 4);
  return {
    items,
    heroExamples: heroExamples.length ? heroExamples : items.slice(0, 3),
    keywords,
    stats: {
      tools: items.length,
      reels: stats.reels,
      commentReels: stats.commentReels,
      commentSolved: stats.commentSolved,
      categories: [...cats.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    },
  };
}

/**
 * Example searches for the search box: short, real queries (top tags and real tool names) that are each checked
 * against the live catalogue, so every suggestion returns results.
 */
export async function exampleSearches(n = 8): Promise<string[]> {
  const { entries: items } = await catalogueData();
  const index = buildIndex(items);
  const tagCounts = new Map<string, number>();
  for (const i of items) for (const t of i.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const tags = [...tagCounts.entries()]
    .filter(([t]) => !/^(open-source|claude|ai|free)$/.test(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([t]) => t.replace(/-/g, " "));
  const names = items.filter((i) => i.name.length <= 18 && !/[(@]/.test(i.name)).slice(0, 6).map((i) => i.name);
  const candidates: string[] = [];
  for (let k = 0; k < Math.max(tags.length, names.length); k++) {
    if (tags[k]) candidates.push(tags[k]);
    if (k % 2 === 1 && names[k >> 1]) candidates.push(names[k >> 1]);
  }
  const out: string[] = [];
  for (const c of candidates) {
    if (out.length >= n) break;
    if (out.some((o) => o.toLowerCase() === c.toLowerCase())) continue;
    if (searchCatalogue(index, c).length > 0) out.push(c);
  }
  return out;
}
