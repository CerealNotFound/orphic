import { requireKey } from "@/lib/keys";
import { listClaimable } from "@/lib/jobs";
import { json } from "@/lib/http";

export async function GET(req: Request) {
  const p = await requireKey(req, "worker");
  if (p instanceof Response) return p;
  const jobs = await listClaimable(p.workspaceId);
  return json({ jobs: jobs.map((j) => ({ ...j, id: Number(j.id) })) });
}
