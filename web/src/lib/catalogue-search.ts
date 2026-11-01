// Search over the open catalogue, run in the browser (and on the server for example searches). No network, no
// dependencies. Every word you type must match something (name, domain, tags, category, use cases or summary),
// as a whole word, a prefix, or with one typo in a name or tag. If nothing matches every word, results that
// match some of the words are shown instead. Results are complete: callers get every match.
import type { CatalogueEntry } from "./public-catalogue";

// Words that describe the question, not the tool ("a free tool to make…"). Nearly everything listed is free, and
// listings rarely say so, so "free" would only hide good matches.
const STOP = new Set([
  "a", "an", "and", "the", "for", "to", "of", "in", "on", "with", "my", "me", "i", "how", "best", "good", "top", "tool", "tools", "ai",
  "app", "apps", "software", "something", "that", "can", "is", "it", "do", "does", "free", "make", "making", "create", "creating",
  "want", "need", "find", "help", "use", "using", "way", "any", "some", "which", "what", "there", "let", "lets", "get", "show",
]);
// Light stemming so "ads" finds "ad" and "videos" finds "video".
const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const words = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).map(stem);

type Field = { words: string[]; weight: number; fuzzy: boolean };
export type SearchIndex = { entry: CatalogueEntry; fields: Field[]; name: string }[];

export function buildIndex(entries: CatalogueEntry[]): SearchIndex {
  return entries.map((e) => ({
    entry: e,
    name: e.name.toLowerCase(),
    fields: [
      { words: words(e.name), weight: 8, fuzzy: true },
      { words: words((e.domain ?? "").replace(/\.[a-z]+$/, "")), weight: 4, fuzzy: false },
      { words: words(e.tags.join(" ")), weight: 4, fuzzy: true },
      { words: words(`${e.category} ${e.kind}`), weight: 2, fuzzy: false },
      { words: words(e.useCases.join(" ")), weight: 2, fuzzy: false },
      { words: words(e.summary), weight: 1, fuzzy: false },
    ],
  }));
}

/** One typo: a letter added, dropped, changed, or two neighbouring letters swapped ("remotoin" → "remotion"). */
function oneTypo(a: string, b: string) {
  if (a.length < 4 || Math.abs(a.length - b.length) > 1 || a === b) return false;
  if (a.length === b.length) {
    const diff: number[] = [];
    for (let i = 0; i < a.length && diff.length < 3; i++) if (a[i] !== b[i]) diff.push(i);
    if (diff.length === 1) return true;
    return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < short.length && long[i] === short[i]) i++;
  return long.slice(i + 1) === short.slice(i);
}

/**
 * Best score for one query word. Only the word being typed (the last one) may match as a prefix, and only in a
 * name, domain or tag (a prefix inside a description, like "tie" in "tiers", is noise).
 */
function scoreWord(fields: Field[], t: string, prefix: boolean) {
  let best = 0;
  for (const f of fields)
    for (const w of f.words) {
      const s = w === t ? 1 : prefix && f.weight >= 4 && t.length >= 2 && w.startsWith(t) ? 0.7 : f.fuzzy && oneTypo(w, t) ? 0.5 : 0;
      if (s * f.weight > best) best = s * f.weight;
    }
  return best;
}

export function searchCatalogue(index: SearchIndex, query: string, category = ""): CatalogueEntry[] {
  const pool = category ? index.filter((x) => x.entry.category === category) : index;
  const all = words(query);
  const terms = all.filter((w) => !STOP.has(w));
  const q = terms.length ? terms : all;
  if (!q.length) return pool.map((x) => x.entry);
  const phrase = query.trim().toLowerCase();

  const scored = pool.map((x, order) => {
    let total = 0;
    let hits = 0;
    for (const [n, t] of q.entries()) {
      const s = scoreWord(x.fields, t, n === q.length - 1 && !/\s$/.test(query));
      total += s;
      if (s > 0) hits++;
    }
    if (x.name === phrase) total += 50;
    else if (x.name.startsWith(phrase)) total += 20;
    return { entry: x.entry, total, hits, order };
  });
  const every = scored.filter((s) => s.hits === q.length);
  const list = every.length ? every : scored.filter((s) => s.hits > 0 && s.hits >= Math.ceil(q.length / 2));
  return list.sort((a, b) => b.hits - a.hits || b.total - a.total || a.order - b.order).map((s) => s.entry);
}
