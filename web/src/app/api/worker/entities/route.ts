import { requireKey } from "@/lib/keys";
import { q } from "@/lib/db";
import { json } from "@/lib/http";

// Lets the worker reuse existing entity names/categories/tags instead of creating near-duplicates.
export async function GET(req: Request) {
  const p = await requireKey(req, "worker");
  if (p instanceof Response) return p;
  const term = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!term) return json({ entities: [] });
  const rows = await q(
    `select id, name, aliases, canonical_url, category, tags, kind, link_status, greatest(word_similarity(names_text, $2), word_similarity($2, names_text)) as similarity
     from entities where workspace_id = $1
       and (names_text ilike '%' || $2 || '%' or word_similarity(names_text, $2) > 0.4 or word_similarity($2, names_text) > 0.4 or domain ilike '%' || $2 || '%')
     order by similarity desc limit 10`,
    [p.workspaceId, term],
  );
  return json({ entities: rows });
}
