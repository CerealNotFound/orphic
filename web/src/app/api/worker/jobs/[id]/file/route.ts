import { requireKey } from "@/lib/keys";
import { q1 } from "@/lib/db";
import { env } from "@/lib/env";
import { tgApi } from "@/lib/telegram/api";
import { err, jobIdOf, type IdParams } from "@/lib/http";

// Streams the Telegram screenshot or document for an image/file job, so the worker never needs the bot token.
export async function GET(req: Request, ctx: IdParams) {
  const p = await requireKey(req, "worker");
  if (p instanceof Response) return p;
  const id = await jobIdOf(ctx);
  if (id instanceof Response) return id;
  const job = await q1<{ input: { telegram_file_id?: string } }>(`select input from jobs where id = $1 and workspace_id = $2`, [id, p.workspaceId]);
  const fileId = job?.input.telegram_file_id;
  if (!fileId) return err("No file for this job", 404);
  const file = await tgApi().getFile(fileId);
  if (!file.file_path) return err("Telegram returned no file path", 502);
  const res = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
  if (!res.ok || !res.body) return err(`Telegram download failed (${res.status})`, 502);
  return new Response(res.body, {
    headers: { "content-type": res.headers.get("content-type") ?? "application/octet-stream", "content-disposition": `attachment; filename="${file.file_path.split("/").pop()}"` },
  });
}
