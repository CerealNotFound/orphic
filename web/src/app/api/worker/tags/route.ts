import { requireKey } from "@/lib/keys";
import { q } from "@/lib/db";
import { CATEGORIES } from "@/lib/contracts";
import { json } from "@/lib/http";

export async function GET(req: Request) {
  const p = await requireKey(req, "worker");
  if (p instanceof Response) return p;
  const rows = await q<{ tag: string; count: string }>(
    `select t as tag, count(*) from entities, unnest(tags) t where workspace_id = $1 group by 1 order by 2 desc, 1 limit 300`,
    [p.workspaceId],
  );
  return json({ categories: CATEGORIES, tags: rows.map((r) => ({ tag: r.tag, count: Number(r.count) })) });
}
