import { requireKey } from "@/lib/keys";
import { getEntity } from "@/lib/search";
import { err, json } from "@/lib/http";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = await requireKey(req, "read");
  if (p instanceof Response) return p;
  const e = await getEntity(p.workspaceId, (await ctx.params).id);
  return e ? json(e) : err("Not found", 404);
}
