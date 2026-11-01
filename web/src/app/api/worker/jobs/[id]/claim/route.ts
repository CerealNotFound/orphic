import { requireKey } from "@/lib/keys";
import { claimJob } from "@/lib/jobs";
import { err, json, jobIdOf, type IdParams } from "@/lib/http";

export async function POST(req: Request, ctx: IdParams) {
  const p = await requireKey(req, "worker");
  if (p instanceof Response) return p;
  const id = await jobIdOf(ctx);
  if (id instanceof Response) return id;
  const claimed = await claimJob(p.workspaceId, id);
  return claimed ? json(claimed) : err("Job is not queued (already claimed, done, or missing)", 409);
}
