import { requireKey } from "@/lib/keys";
import { CHUNK_BYTES, finalizeSnapshot, putChunk } from "@/lib/snapshots";
import { err, json } from "@/lib/http";

type Ctx = { params: Promise<{ sid: string }> };

// PUT ?idx=N with the raw chunk bytes (≤ 3 MB each).
export async function PUT(req: Request, ctx: Ctx) {
  const p = await requireKey(req, "worker");
  if (p instanceof Response) return p;
  const { sid } = await ctx.params;
  const idx = Number(new URL(req.url).searchParams.get("idx"));
  if (!Number.isInteger(idx) || idx < 0 || idx > 20) return err("idx must be 0..20");
  const data = Buffer.from(await req.arrayBuffer());
  if (!data.length || data.length > CHUNK_BYTES) return err(`Chunk must be 1..${CHUNK_BYTES} bytes`);
  return (await putChunk(p.workspaceId, sid, idx, data)) ? json({ ok: true }) : err("Snapshot not found or already finished", 404);
}

// POST to finish the upload.
export async function POST(req: Request, ctx: Ctx) {
  const p = await requireKey(req, "worker");
  if (p instanceof Response) return p;
  const { sid } = await ctx.params;
  return (await finalizeSnapshot(p.workspaceId, sid)) ? json({ ok: true }) : err("No chunks uploaded", 400);
}
