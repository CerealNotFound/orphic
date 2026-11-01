import { requireKey } from "@/lib/keys";
import { completeJob } from "@/lib/jobs";
import { JobResult } from "@/lib/contracts";
import { err, json, jobIdOf, parseBody, type IdParams } from "@/lib/http";

export const maxDuration = 60;

export async function POST(req: Request, ctx: IdParams) {
  const p = await requireKey(req, "worker");
  if (p instanceof Response) return p;
  const id = await jobIdOf(ctx);
  if (id instanceof Response) return id;
  const body = await parseBody(req, JobResult);
  if (body instanceof Response) return body;
  const out = await completeJob(p.workspaceId, id, body);
  if ("ok" in out) return json(out);
  return err(String(out.error), Number(out.status) || 400);
}
