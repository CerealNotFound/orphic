// A saved copy from the open catalogue (a Drive file, a Google Doc as PDF, a Notion page), served to anyone.
// Only copies that belong to a public entry (see publicFileMeta). Files never run scripts. One query to check and
// describe the file; cached at the CDN, so repeat views don't touch the database or storage.
import { privateDownloadUrl } from "@/lib/cloudinary";
import { publicFileMeta, readChunks, streamChunks } from "@/lib/public-files";

const NOT_FOUND = () => new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (process.env.PUBLIC_FILES === "off") return new Response("Saved copies are paused. Try again later.", { status: 503 });
  const id = (await ctx.params).id;
  const meta = await publicFileMeta(id);
  if (!meta) return NOT_FOUND();

  const download = new URL(req.url).searchParams.has("download");
  const name = meta.filename.replace(/["\r\n\\]/g, "").trim();
  const disposition = `${download ? "attachment" : "inline"}; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name.split("/").pop() ?? name)}`;

  // Large files live in Cloudinary: hand out a short-lived signed link.
  if (meta.storage === "cloudinary" && meta.external) {
    return new Response(null, { status: 302, headers: { location: privateDownloadUrl(meta.external, 3600), "cache-control": "public, max-age=300, s-maxage=1800" } });
  }

  const headers: Record<string, string> = {
    "content-type": meta.content_type,
    "content-disposition": disposition,
    "cache-control": "public, max-age=3600, s-maxage=604800, immutable",
    "x-content-type-options": "nosniff",
  };
  // PDFs, images, audio and video show in the browser's own viewer (a sandbox would block the PDF viewer).
  // Anything else is locked down so it can never act as a page on this site.
  if (!/^(application\/pdf|image\/(png|jpe?g|gif|webp|avif)|audio\/|video\/)/.test(meta.content_type))
    headers["content-security-policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

  // A full page copy (Notion): point its images and files at the public copies, and never run scripts.
  if (meta.content_type.startsWith("text/html")) {
    const html = (await readChunks(id))
      .toString("utf8")
      .replace(/(https?:\/\/[^"'\s)]*)?\/api\/snapshots\//g, "/api/public/files/")
      // The team copy opens with a "private copy" note; the public page already says what this is.
      .replace(/<p class="banner">[\s\S]*?<\/p>\s*/, "");
    const self = new URL(req.url).origin;
    headers["content-security-policy"] = `default-src 'none'; img-src ${self} data: https://api.cloudinary.com https://res.cloudinary.com; media-src ${self} https://api.cloudinary.com https://res.cloudinary.com; style-src 'unsafe-inline'; form-action 'none'; frame-ancestors 'self'; sandbox allow-same-origin allow-popups allow-popups-to-escape-sandbox`;
    return new Response(html, { headers });
  }
  headers["content-length"] = String(meta.size_bytes);
  return new Response(streamChunks(id, meta.chunk_count), { headers });
}
