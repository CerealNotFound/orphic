import { requireKey } from "@/lib/keys";
import { searchEntities } from "@/lib/search";
import { json } from "@/lib/http";

// GET /api/v1/search?q=...&category=&kind=&tag=&limit=&offset=
export async function GET(req: Request) {
  const p = await requireKey(req, "read");
  if (p instanceof Response) return p;
  const s = new URL(req.url).searchParams;
  const page = await searchEntities(p.workspaceId, s.get("q") ?? "", {
    category: s.get("category") ?? undefined,
    kind: s.get("kind") ?? undefined,
    tag: s.get("tag") ?? undefined,
    limit: Number(s.get("limit") ?? 10),
    offset: Number(s.get("offset") ?? 0),
  });
  return json(page);
}
