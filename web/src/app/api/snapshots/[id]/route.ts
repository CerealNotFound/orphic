// Private download of a saved copy: signed-in teammates (web) or a read API key. Never public.
import { getViewer } from "@/lib/auth";
import { bearer, verifyApiKey } from "@/lib/keys";
import { streamSnapshot } from "@/lib/snapshots";
import { privateDownloadUrl } from "@/lib/cloudinary";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let workspaceId: string | null = null;
  const key = await verifyApiKey(bearer(req));
  if (key?.scopes.includes("read")) workspaceId = key.workspaceId;
  else workspaceId = (await getViewer())?.member?.workspace_id ?? null;
  if (!workspaceId) return new Response("Sign in to Orphic to open saved copies.", { status: 401 });

  const snap = await streamSnapshot(workspaceId, (await ctx.params).id);
  if (!snap) return new Response("Not found", { status: 404 });
  // Large files live privately in Cloudinary: hand out a link that works for 1 hour.
  if (snap.meta.storage === "cloudinary" && snap.meta.external) {
    return new Response(null, { status: 302, headers: { location: privateDownloadUrl(snap.meta.external), "cache-control": "private, no-store" } });
  }
  if (!snap.body) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  const name = snap.meta.filename.replace(/["\r\n]/g, "");
  // A full site copy (HTML written by the worker) shows its images and videos from the team's other saved copies.
  // Scripts never run in saved files: no script source is allowed and the page is sandboxed without allow-scripts.
  // allow-same-origin only lets those image/video requests carry the sign-in cookie.
  const isHtml = snap.meta.content_type.startsWith("text/html");
  const self = new URL(req.url).origin;
  const csp = isHtml
    ? `default-src 'none'; img-src ${self} data: https://api.cloudinary.com https://res.cloudinary.com; media-src ${self} https://api.cloudinary.com https://res.cloudinary.com; style-src 'unsafe-inline'; form-action 'none'; sandbox allow-same-origin`
    : "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox";
  return new Response(snap.body, {
    headers: {
      "content-type": snap.meta.content_type,
      "content-length": String(snap.meta.size_bytes),
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": csp,
    },
  });
}
