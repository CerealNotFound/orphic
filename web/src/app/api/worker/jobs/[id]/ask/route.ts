import { requireKey } from "@/lib/keys";
import { askJob } from "@/lib/jobs";
import { JobAsk } from "@/lib/contracts";
import { err, json, jobIdOf, parseBody, type IdParams } from "@/lib/http";

export async function POST(req: Request, ctx: IdParams) {
  const p = await requireKey(req, "worker");
  if (p instanceof Response) return p;
  const id = await jobIdOf(ctx);
  if (id instanceof Response) return id;
  const body = await parseBody(req, JobAsk);
  if (body instanceof Response) return body;
  return (await askJob(p.workspaceId, id, body.question, body.options)) ? json({ ok: true }) : err("Job is not processing", 409);
}
