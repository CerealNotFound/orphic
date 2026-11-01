import { requireKey } from "@/lib/keys";
import { progressJob } from "@/lib/jobs";
import { JobProgress } from "@/lib/contracts";
import { err, json, jobIdOf, parseBody, type IdParams } from "@/lib/http";

export async function POST(req: Request, ctx: IdParams) {
  const p = await requireKey(req, "worker");
  if (p instanceof Response) return p;
  const id = await jobIdOf(ctx);
  if (id instanceof Response) return id;
  const body = await parseBody(req, JobProgress);
  if (body instanceof Response) return body;
  return (await progressJob(p.workspaceId, id, body.text)) ? json({ ok: true }) : err("Job not found", 404);
}
