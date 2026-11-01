import { requireKey } from "@/lib/keys";
import { listEntities } from "@/lib/search";
import { json } from "@/lib/http";

// GET /api/v1/items?category=&kind=&tag=&text=&link_status=&since=&limit=&offset=  (exhaustive, paginated)
export async function GET(req: Request) {
  const p = await requireKey(req, "read");
  if (p instanceof Response) return p;
  const s = new URL(req.url).searchParams;
  const opt = (k: string) => s.get(k) ?? undefined;
  return json(
    await listEntities(p.workspaceId, {
      category: opt("category"), kind: opt("kind"), tag: opt("tag"), text: opt("text"), link_status: opt("link_status"), since: opt("since"),
      limit: Number(s.get("limit") ?? 25), offset: Number(s.get("offset") ?? 0),
    }),
  );
}
