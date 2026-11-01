import { requireKey } from "@/lib/keys";
import { facets } from "@/lib/search";
import { json } from "@/lib/http";

export async function GET(req: Request) {
  const p = await requireKey(req, "read");
  if (p instanceof Response) return p;
  return json(await facets(p.workspaceId));
}
