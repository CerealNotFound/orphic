import { z } from "zod";
import { requireKey } from "@/lib/keys";
import { createSnapshot, MAX_SNAPSHOT_BYTES, pruneSnapshots } from "@/lib/snapshots";
import { err, json, jobIdOf, parseBody, type IdParams } from "@/lib/http";

const Body = z.object({
  kind: z.enum(["original", "pdf", "text"]),
  filename: z.string().min(1).max(200),
  content_type: z.string().min(1).max(120),
  size_bytes: z.number().int().positive().max(100 * 1024 * 1024),
  source_url: z.string().nullish(),
  // A file inside a full copy (an image or attachment of a Notion site), listed under its main copy.
  part: z.boolean().nullish(),
  // Set when the file was uploaded to Cloudinary by the worker; no chunks are sent then.
  cloudinary: z
    .object({ public_id: z.string(), resource_type: z.enum(["image", "video", "raw"]), format: z.string(), version: z.number(), bytes: z.number() })
    .nullish(),
});

// Start a saved copy for a job; then upload chunks to /api/worker/snapshots/{sid}?idx=N and POST there to finish.
export async function POST(req: Request, ctx: IdParams) {
  const p = await requireKey(req, "worker");
  if (p instanceof Response) return p;
  const id = await jobIdOf(ctx);
  if (id instanceof Response) return id;
  const body = await parseBody(req, Body);
  if (body instanceof Response) return body;
  // A worker may only point a copy at files it uploaded for this job, never at other assets in the account.
  if (body.cloudinary && (!body.cloudinary.public_id.startsWith(`orphic/${id}/`) || body.cloudinary.public_id.includes("..")))
    return err("cloudinary.public_id must be inside this job's folder", 400);
  if (!body.cloudinary && body.size_bytes > MAX_SNAPSHOT_BYTES) return err(`Files over ${MAX_SNAPSHOT_BYTES} bytes must go to external storage`, 413);
  const sid = await createSnapshot(p.workspaceId, id, body);
  return sid ? json({ id: sid }) : err("Job not found", 404);
}

const Prune = z.object({ keep: z.array(z.uuid()).min(1).max(2000) });

// Re-copying a link: remove this capture's older copies, keeping the ones just uploaded.
export async function DELETE(req: Request, ctx: IdParams) {
  const p = await requireKey(req, "worker");
  if (p instanceof Response) return p;
  const id = await jobIdOf(ctx);
  if (id instanceof Response) return id;
  const body = await parseBody(req, Prune);
  if (body instanceof Response) return body;
  const removed = await pruneSnapshots(p.workspaceId, id, body.keep);
  return removed === null ? err("Job not found or not finished", 404) : json({ removed });
}
