// Search over entities (tools, workflows, prompts…).
// Two modes, by design:
//  - listEntities: exhaustive filters, returns every match with a total (for "everything about X").
//  - searchEntities: hybrid ranking (keyword + fuzzy name + vector, fused with RRF) for fuzzy questions.
import { q } from "./db";
import { embedQuery, toVectorLiteral } from "./embeddings";

export type EntityFilters = {
  category?: string;
  kind?: string;
  tag?: string;
  link_status?: string;
  saved_by?: string; // member id
  since?: string; // ISO date
};

export type EntityHit = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  canonical_url: string | null;
  domain: string | null;
  summary: string;
  use_cases: string[];
  category: string;
  tags: string[];
  pricing: string | null;
  is_creator_owned: boolean;
  creator_handle: string | null;
  link_status: string;
  save_count: number;
  rating_score: number;
  savers: string[];
  updated_at: string;
  score?: number;
};

export type Page<T> = { total: number; items: T[]; offset: number; limit: number; next_offset: number | null };

const RRF_K = 60;
// Vector neighbours count as "matches" only above this cosine similarity (tune with the golden set).
const VECTOR_MIN_SIMILARITY = 0.35;
const TRIGRAM_MIN = 0.5;
const CANDIDATES = 100;
// Keyword precision: ignore words found in more than half the items (once there are enough items to tell),
// and require a match on at least half of the remaining words.
const MIN_CORPUS_FOR_IDF = 8;
const COMMON_WORD_SHARE = 0.5;
const MIN_TERM_SHARE = 0.5;

function filterSql(f: EntityFilters, params: unknown[], alias = "e"): string {
  const parts: string[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    parts.push(sql.replace("?", `$${params.length}`));
  };
  if (f.category) add(`${alias}.category = ?`, f.category);
  if (f.kind) add(`${alias}.kind = ?`, f.kind);
  if (f.tag) add(`? = any(${alias}.tags)`, f.tag);
  if (f.link_status) add(`${alias}.link_status = ?`, f.link_status);
  if (f.since) add(`${alias}.updated_at >= ?::timestamptz`, f.since);
  if (f.saved_by)
    add(
      `exists (select 1 from capture_entities ce join saves s on s.capture_id = ce.capture_id where ce.entity_id = ${alias}.id and s.member_id = ?)`,
      f.saved_by,
    );
  return parts.length ? " and " + parts.join(" and ") : "";
}

// Words that appear in almost every question ("best tool to…") and would match everything. Stemmed forms.
const GENERIC_WORDS = [
  "tool", "best", "app", "ai", "use", "make", "help", "good", "free", "websit", "site", "thing", "someth", "want", "need",
  "find", "show", "way", "anyth", "can", "get", "like", "one", "realli", "top", "list", "everyth", "save", "orphic", "remember",
  "rememb", "saw", "seen", "reel", "post", "link",
];
const GENERIC_SQL = `array[${GENERIC_WORDS.map((w) => `'${w}'`).join(",")}]`;

// OR-query of the stemmed words in the user's text, so natural-language questions still match.
const OR_TSQUERY = (p: string) =>
  `(select case when count(*) = 0 then null else array_to_string(array_agg(quote_literal(lexeme)), ' | ')::tsquery end
    from unnest(to_tsvector('english', ${p})) where lexeme <> all(${GENERIC_SQL}))`;

const SELECT_HIT = `
  e.id, e.name, e.slug, e.kind, e.canonical_url, e.domain, e.summary, e.use_cases, e.category, e.tags, e.pricing,
  e.is_creator_owned, e.creator_handle, e.link_status, e.save_count, e.rating_score, e.updated_at,
  coalesce((select array_agg(distinct m.display_name) from capture_entities ce
            join saves s on s.capture_id = ce.capture_id join members m on m.id = s.member_id
            where ce.entity_id = e.id), '{}') as savers`;

export async function listEntities(workspaceId: string, opts: EntityFilters & { text?: string; limit?: number; offset?: number } = {}): Promise<Page<EntityHit>> {
  const limit = Math.min(opts.limit ?? 25, 100);
  const offset = opts.offset ?? 0;
  const params: unknown[] = [workspaceId];
  let where = `e.workspace_id = $1` + filterSql(opts, params);
  if (opts.text?.trim()) {
    params.push(opts.text.trim());
    const p = `$${params.length}`;
    where += ` and (e.search_tsv @@ ${OR_TSQUERY(p)} or word_similarity(e.names_text, ${p}) >= ${TRIGRAM_MIN})`;
  }
  params.push(limit, offset);
  const rows = await q<EntityHit & { total: string }>(
    `select ${SELECT_HIT}, count(*) over () as total from entities e where ${where}
     order by e.save_count desc, e.rating_score desc, e.updated_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  );
  const total = rows.length ? Number(rows[0].total) : offset > 0 ? await countEntities(workspaceId, opts) : 0;
  return page(rows, total, offset, limit);
}

async function countEntities(workspaceId: string, f: EntityFilters) {
  const params: unknown[] = [workspaceId];
  const rows = await q<{ n: string }>(`select count(*) as n from entities e where e.workspace_id = $1 ${filterSql(f, params)}`, params);
  return Number(rows[0].n);
}

export async function searchEntities(
  workspaceId: string,
  query: string,
  opts: EntityFilters & { limit?: number; offset?: number } = {},
): Promise<Page<EntityHit>> {
  // Strict first (precise counts); if that finds almost nothing, loosen so nothing relevant is missed.
  const strict = await runSearch(workspaceId, query, opts, true);
  if (strict.total >= 3 || !query.trim()) return strict;
  const loose = await runSearch(workspaceId, query, opts, false);
  return loose.total > strict.total ? loose : strict;
}

async function runSearch(
  workspaceId: string,
  query: string,
  opts: EntityFilters & { limit?: number; offset?: number },
  strict: boolean,
): Promise<Page<EntityHit>> {
  const limit = Math.min(opts.limit ?? 10, 50);
  const offset = opts.offset ?? 0;
  const text = query.trim();
  if (!text) return listEntities(workspaceId, { ...opts, limit, offset });

  // Fuzzy name matching is for names and typos ("remotoin"). For longer questions a single shared word
  // ("agent", "animation") must not count as a name match, so the bar is higher.
  const words = text.split(/\s+/).filter(Boolean).length;
  const trigramMin = words === 1 ? TRIGRAM_MIN : words === 2 ? 0.65 : 0.8;
  const vector = await embedQuery(text);
  const params: unknown[] = [workspaceId, text];
  const filters = filterSql(opts, params);
  let vecCte = `vec as (select null::uuid as id, null::bigint as rnk where false)`;
  if (vector) {
    params.push(toVectorLiteral(vector));
    const v = `$${params.length}::halfvec`;
    // Exact scan (no ANN index) so filters never drop matches; fine for tens of thousands of rows.
    vecCte = `vec as (
      select e.id, row_number() over (order by ee.embedding <=> ${v}) as rnk
      from entity_embeddings ee join entities e on e.id = ee.entity_id
      where ee.workspace_id = $1 and 1 - (ee.embedding <=> ${v}) >= ${VECTOR_MIN_SIMILARITY} ${filters}
      order by ee.embedding <=> ${v} limit ${CANDIDATES})`;
  }
  params.push(limit, offset);
  const rows = await q<EntityHit & { total: string; score: number }>(
    `with qlex as (
       select distinct lexeme from unnest(to_tsvector('english', $2)) where lexeme <> all(${GENERIC_SQL})),
     corpus as (select count(*)::float as n from entities where workspace_id = $1),
     df as (
       select ql.lexeme, (select count(*) from entities e where e.workspace_id = $1 and e.search_tsv @@ quote_literal(ql.lexeme)::tsquery) as ndoc
       from qlex ql),
     -- Words that appear in most items (e.g. "claude" or "video" in a Claude-video library) don't tell items apart, so they don't count.
     informative as (
       select lexeme from df, corpus where corpus.n < ${MIN_CORPUS_FOR_IDF} or df.ndoc <= corpus.n * ${COMMON_WORD_SHARE}),
     terms as (
       select coalesce(case when exists (select 1 from informative) then (select array_agg(lexeme) from informative)
                            else (select array_agg(lexeme) from qlex) end, '{}') as arr),
     allq as (select coalesce(array_agg(lexeme), '{}') as arr from qlex),
     tq as (
       select case when cardinality(arr) = 0 then null
                   else array_to_string(array(select quote_literal(t) from unnest(arr) t), ' | ')::tsquery end as q,
              cardinality(arr) as k, arr from terms),
     fts_all as (
       select e.id, ts_rank_cd(e.search_tsv, tq.q, 32) as rank, tq.k,
              (select count(*) from unnest(tsvector_to_array(e.search_tsv)) l where l = any(tq.arr)) as matched,
              -- Common words don't qualify an item, but they still break ties ("claude code alternative").
              (select count(*) from unnest(tsvector_to_array(e.search_tsv)) l where l = any(allq.arr)) as matched_all
       from entities e, tq, allq where e.workspace_id = $1 and tq.q is not null and e.search_tsv @@ tq.q ${filters}),
     -- An item must match every meaningful word of a 1-2 word question, or at least half of a longer one.
     fts as (
       select id, row_number() over (order by matched desc, matched_all desc, rank desc) as rnk from fts_all
       where matched >= case when ${strict} and k <= 2 then k else greatest(1, ceil(k * ${MIN_TERM_SHARE})) end
       order by matched desc, matched_all desc, rank desc limit ${CANDIDATES}),
     -- Fuzzy name match, both ways: a misspelled name ("remotoin") or a name inside a longer question.
     trg_all as (
       select e.id, greatest(word_similarity($2, e.names_text), word_similarity(e.names_text, $2)) as sim
       from entities e where e.workspace_id = $1 ${filters}),
     trg as (
       select id, sim, row_number() over (order by sim desc) as rnk from trg_all
       where sim >= ${trigramMin} order by sim desc limit ${CANDIDATES}),
     ${vecCte},
     fused as (
       select id, sum(w / (${RRF_K} + rnk)) as score from (
         select id, rnk, 1.0 as w from fts
         union all select id, rnk, case when sim >= 0.8 then 2.0 else 0.6 end as w from trg
         union all select id, rnk, 1.0 as w from vec) x
       group by id)
     select ${SELECT_HIT}, f.score, count(*) over () as total
     from fused f join entities e on e.id = f.id
     order by f.score desc, e.save_count desc, e.rating_score desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  );
  const total = rows.length ? Number(rows[0].total) : 0;
  return page(rows, total, offset, limit);
}

function page<T extends { total?: string }>(rows: T[], total: number, offset: number, limit: number): Page<Omit<T, "total">> {
  const items = rows.map(({ total: _t, ...rest }) => rest);
  return { total, items, offset, limit, next_offset: offset + items.length < total ? offset + items.length : null };
}

export async function facets(workspaceId: string) {
  const [categories, tags, kinds, totals] = await Promise.all([
    q<{ value: string; count: string }>(`select category as value, count(*) from entities where workspace_id = $1 group by 1 order by 2 desc`, [workspaceId]),
    q<{ value: string; count: string }>(`select t as value, count(*) from entities, unnest(tags) t where workspace_id = $1 group by 1 order by 2 desc limit 200`, [workspaceId]),
    q<{ value: string; count: string }>(`select kind as value, count(*) from entities where workspace_id = $1 group by 1 order by 2 desc`, [workspaceId]),
    q<{ entities: string; captures: string; members: string }>(
      `select (select count(*) from entities where workspace_id = $1) as entities,
              (select count(*) from captures where workspace_id = $1) as captures,
              (select count(*) from members where workspace_id = $1) as members`,
      [workspaceId],
    ),
  ]);
  const n = (rows: { value: string; count: string }[]) => rows.map((r) => ({ value: r.value, count: Number(r.count) }));
  return {
    totals: { entities: Number(totals[0].entities), captures: Number(totals[0].captures), members: Number(totals[0].members) },
    categories: n(categories),
    kinds: n(kinds),
    tags: n(tags),
  };
}

export async function getEntity(workspaceId: string, idOrSlug: string) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const rows = await q<EntityHit & { aliases: string[] }>(
    `select ${SELECT_HIT}, e.aliases from entities e where e.workspace_id = $1 and ${isUuid ? "e.id = $2::uuid" : "e.slug = $2"}`,
    [workspaceId, idOrSlug],
  );
  const entity = rows[0];
  if (!entity) return null;
  const [captures, ratings, related] = await Promise.all([
    q<{ id: string; kind: string; source_url: string | null; creator_handle: string | null; caption: string | null; summary: string | null; status: string; created_at: string; role: string; saved_by: string[] }>(
      `select c.id, c.kind, c.source_url, c.creator_handle, left(c.caption, 600) as caption, c.summary, c.status, c.created_at, ce.role,
              coalesce((select array_agg(m.display_name order by s.created_at) from saves s join members m on m.id = s.member_id where s.capture_id = c.id), '{}') as saved_by
       from capture_entities ce join captures c on c.id = ce.capture_id where ce.entity_id = $1 order by c.created_at desc`,
      [entity.id],
    ),
    q<{ member: string; value: number; comment: string | null; created_at: string }>(
      `select m.display_name as member, r.value, r.comment, r.created_at from ratings r join members m on m.id = r.member_id where r.entity_id = $1 order by r.created_at desc`,
      [entity.id],
    ),
    // Other items from the same reels/links (e.g. the rest of a "5 tools" list), so each one is reachable from the others.
    q<{ id: string; name: string; slug: string; kind: string; domain: string | null; link_status: string; summary: string; role: string }>(
      `select distinct on (o.id) o.id, o.name, o.slug, o.kind, o.domain, o.link_status, o.summary, ce2.role
       from capture_entities ce
       join capture_entities ce2 on ce2.capture_id = ce.capture_id and ce2.entity_id <> ce.entity_id
       join entities o on o.id = ce2.entity_id and o.workspace_id = $2
       where ce.entity_id = $1
       order by o.id, (ce2.role = 'primary') desc`,
      [entity.id, workspaceId],
    ),
  ]);
  related.sort((a, b) => Number(b.role === "primary") - Number(a.role === "primary") || a.name.localeCompare(b.name));
  return { ...entity, captures, ratings, related };
}

export async function recentSaves(workspaceId: string, limit = 20) {
  return q<{ saved_at: string; member: string; capture_id: string; kind: string; source_url: string | null; status: string; entity_name: string | null; entity_slug: string | null; summary: string | null }>(
    `select s.created_at as saved_at, m.display_name as member, c.id as capture_id, c.kind, c.source_url, c.status,
            e.name as entity_name, e.slug as entity_slug, coalesce(e.summary, c.summary) as summary
     from saves s join members m on m.id = s.member_id join captures c on c.id = s.capture_id
     left join lateral (select e.* from capture_entities ce join entities e on e.id = ce.entity_id
                        where ce.capture_id = c.id order by (ce.role = 'primary') desc limit 1) e on true
     where s.workspace_id = $1 order by s.created_at desc limit $2`,
    [workspaceId, limit],
  );
}
