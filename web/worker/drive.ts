// Archive a public Google Drive file or folder (recursively) to local disk, so resources survive if the link dies.
// Uses only fetch + Drive's public pages; works for "anyone with the link" shares.
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveEntry = { id: string; name: string; mime: string };
export type ArchivedFile = { path: string; name: string; mime: string; bytes: number; driveId: string };

const unesc = (s: string) =>
  s.replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\\//g, "/").replace(/&amp;/g, "&").replace(/&#39;/g, "'");
// Folder/file names come from strangers: no separators, and no leading dots (blocks "..", ".", hidden files like ".zshenv").
const safe = (s: string) => s.replace(/[/\\:*?"<>|\x00-\x1f]+/g, "-").trim().replace(/^\.+/, "_").slice(0, 150) || "untitled";

export function driveId(url: string): { kind: "folder" | "file"; id: string } | null {
  const folder = url.match(/drive\.google\.com\/(?:drive\/(?:mobile\/)?(?:u\/\d+\/)?folders|embeddedfolderview\?id=)\/?([\w-]{20,})/);
  if (folder) return { kind: "folder", id: folder[1] };
  const file = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=download&)?id=)([\w-]{20,})/);
  return file ? { kind: "file", id: file[1] } : null;
}

/** Lists a public folder's direct children (name, id, mime) from the folder page's embedded data. */
export async function listFolder(id: string): Promise<{ title: string; entries: DriveEntry[] }> {
  const res = await fetch(`https://drive.google.com/drive/folders/${id}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30_000) });
  const html = await res.text();
  const title = unesc(html.match(/<title>(.*?) - Google Drive<\/title>/)?.[1] ?? id);
  const re = /\\x22([\w-]{25,44})\\x22,\\x5b\\x22[\w-]{25,44}\\x22\\x5d,\\x22(.*?)\\x22,\\x22(.*?)\\x22/g;
  const seen = new Map<string, DriveEntry>();
  for (const m of html.matchAll(re)) if (!seen.has(m[1])) seen.set(m[1], { id: m[1], name: unesc(m[2]), mime: unesc(m[3]) });
  return { title, entries: [...seen.values()] };
}

async function downloadFile(id: string, dest: string, url = driveDownloadUrl(id)): Promise<{ bytes: number; mime: string } | null> {
  const res = await fetch(url, {
    headers: { "user-agent": UA },
    redirect: "follow",
    signal: AbortSignal.timeout(15 * 60_000),
  });
  const mime = (res.headers.get("content-type") ?? "").split(";")[0];
  if (!res.ok || !res.body || mime.includes("text/html")) return null; // not public, or a virus-scan/quota page
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
  return { bytes: statSync(dest).size, mime };
}

// `exportUrl`: native Google Docs/Sheets/Slides have no file to download; they're exported (PDF / Excel) instead.
export type DriveFile = DriveEntry & { path: string; exportUrl?: string };

const EXPORTS: Record<string, { url: (id: string) => string; ext: string; mime: string }> = {
  "application/vnd.google-apps.document": { url: (id) => `https://docs.google.com/document/d/${id}/export?format=pdf`, ext: "pdf", mime: "application/pdf" },
  "application/vnd.google-apps.presentation": { url: (id) => `https://docs.google.com/presentation/d/${id}/export/pdf`, ext: "pdf", mime: "application/pdf" },
  "application/vnd.google-apps.spreadsheet": {
    url: (id) => `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,
    ext: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
};

/** Lists every file in a public folder tree (recursively), with its path inside the folder. */
export async function listTree(url: string): Promise<{ title: string; files: DriveFile[]; skipped: string[] }> {
  const target = driveId(url);
  if (!target) throw new Error("Not a Google Drive file or folder link");
  if (target.kind === "file") return { title: target.id, files: [{ id: target.id, name: target.id, mime: "", path: target.id }], skipped: [] };
  const files: DriveFile[] = [];
  const skipped: string[] = [];
  const walk = async (id: string, prefix: string, depth: number) => {
    if (depth > 6) return;
    for (const e of (await listFolder(id)).entries) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.mime === FOLDER_MIME) await walk(e.id, path, depth + 1);
      else if (EXPORTS[e.mime]) {
        const x = EXPORTS[e.mime];
        files.push({ ...e, name: `${e.name}.${x.ext}`, mime: x.mime, path: `${path}.${x.ext}`, exportUrl: x.url(e.id) });
      } else if (e.mime.startsWith("application/vnd.google-apps.")) skipped.push(`${path} (Google Forms/Drawings/other app file: can't be copied)`);
      else files.push({ ...e, path });
    }
  };
  const { title } = await listFolder(target.id);
  await walk(target.id, "", 0);
  return { title, files, skipped };
}

export const driveDownloadUrl = (id: string) => `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
export { downloadFile };

/** Downloads a public Drive file or folder tree into `root`. Existing files are skipped (safe to re-run). */
export async function archiveDrive(url: string, root: string, log: (s: string) => void = () => {}): Promise<{ folder: string; files: ArchivedFile[]; failed: string[] }> {
  const target = driveId(url);
  if (!target) throw new Error("Not a Google Drive file or folder link");
  const files: ArchivedFile[] = [];
  const failed: string[] = [];

  const walk = async (id: string, dir: string, depth: number) => {
    if (depth > 6) return;
    const { entries } = await listFolder(id);
    mkdirSync(dir, { recursive: true });
    for (const e of entries) {
      if (e.mime === FOLDER_MIME) {
        await walk(e.id, join(dir, safe(e.name)), depth + 1);
        continue;
      }
      if (e.mime.startsWith("application/vnd.google-apps.")) {
        failed.push(`${e.name} (Google Docs/Sheets file: archive it via its own link)`);
        continue;
      }
      const dest = join(dir, safe(e.name));
      if (existsSync(dest) && statSync(dest).size > 0) {
        files.push({ path: dest, name: e.name, mime: e.mime, bytes: statSync(dest).size, driveId: e.id });
        continue;
      }
      log(`downloading ${e.name}`);
      const got = await downloadFile(e.id, dest);
      if (got) files.push({ path: dest, name: e.name, mime: e.mime || got.mime, bytes: got.bytes, driveId: e.id });
      else failed.push(e.name);
    }
  };

  if (target.kind === "folder") {
    const { title } = await listFolder(target.id);
    const folder = join(root, safe(title));
    await walk(target.id, folder, 0);
    return { folder, files, failed };
  }
  mkdirSync(root, { recursive: true });
  const dest = join(root, `drive-${target.id}`);
  const got = await downloadFile(target.id, dest);
  if (got) files.push({ path: dest, name: `drive-${target.id}`, mime: got.mime, bytes: got.bytes, driveId: target.id });
  else failed.push(target.id);
  return { folder: root, files, failed };
}
