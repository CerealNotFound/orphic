// Public saved copies. Drive folders, Google Docs and Notion pages can be taken down or made private at any time, so
// the open catalogue shows our saved copy of them instead of sending people to the original link.
// Only copies for public entries whose own link can be revoked are served, and never anything from a social post.
// Cost: a files page is one query (prerendered, refreshed hourly); a file is one query, then cached at the CDN.
import { cacheLife, cacheTag } from "next/cache";
import { q, q1 } from "./db";
import { catalogueData } from "./public-catalogue";
import { PUBLIC_WS_SQL, publicWsParam, REVOCABLE_SQL, SOCIAL_SQL } from "./public-links";
import type { SnapshotMeta } from "./snapshots";

export type PublicFile = {
  id: string;
  name: string; // may contain folders: "Advice/#1/clip.mp4"
  type: string;
  size: number;
  kind: "original" | "pdf" | "text";
  part: boolean;
  source: string | null;
  savedAt: string;
};

export type PublicCopy = { slug: string; name: string; url: string; summary: string; category: string; files: PublicFile[] };

/** A catalogue entry's saved copy, by slug. Null when the entry has no public copy. */
export async function publicCopy(slug: string): Promise<PublicCopy | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("public-catalogue");
  const { workspaceId, entries, meta } = await catalogueData();
  const item = entries.find((e) => e.slug === slug);
  if (!workspaceId || !item?.files) return null;
  const rows = await q<{ id: string; filename: string; content_type: string; size_bytes: string; kind: PublicFile["kind"]; part: boolean; source_url: string; created_at: Date }>(
    `select distinct on (s.id) s.id, s.filename, s.content_type, s.size_bytes, s.kind, s.part, s.source_url, s.created_at
       from snapshots s join capture_entities ce on ce.capture_id = s.capture_id
      where s.workspace_id = $1 and ce.entity_id = $2 and s.complete
        and s.source_url is not null and s.source_url !~* ${SOCIAL_SQL}`,
    [workspaceId, meta[slug].id],
  );
  const files = rows
    .map((r) => ({
      id: r.id,
      name: r.filename.trim(),
      type: r.content_type,
      size: Number(r.size_bytes) || 0,
      kind: r.kind,
      part: r.part,
      source: r.source_url,
      savedAt: new Date(r.created_at).toISOString(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  if (!files.length) return null;
  return { slug: item.slug, name: item.name, url: item.url, summary: item.summary, category: item.category, files };
}

/** Slugs of entries with a public saved copy (for prerendering their files pages). No database work. */
export async function slugsWithFiles(): Promise<string[]> {
  return (await catalogueData()).entries.filter((e) => e.files).map((e) => e.slug);
}

/** A saved copy's details, only if it belongs to a public entry: one query that checks and fetches at once. */
export async function publicFileMeta(id: string): Promise<(SnapshotMeta & { chunk_count: number }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return q1<SnapshotMeta & { chunk_count: number }>(
    `select s.id, s.capture_id, s.kind, s.filename, s.content_type, s.size_bytes, s.source_url, s.created_at, s.storage, s.external, s.chunk_count
       from snapshots s
      where s.id = $2 and s.workspace_id = ${PUBLIC_WS_SQL} and s.complete
        and s.source_url is not null and s.source_url !~* ${SOCIAL_SQL}
        and exists (select 1 from capture_entities ce
                      join public_items p on p.id = ce.entity_id and p.workspace_id = s.workspace_id and p.url ~* ${REVOCABLE_SQL}
                     where ce.capture_id = s.capture_id)`,
    [publicWsParam(), id],
  );
}

/** The bytes of a database-stored copy, streamed one stored chunk at a time. */
export function streamChunks(id: string, chunkCount: number): ReadableStream<Uint8Array> {
  let idx = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const row = await q1<{ data: Buffer }>(`select data from snapshot_chunks where snapshot_id = $1 and idx = $2`, [id, idx++]);
      if (!row) return controller.close();
      controller.enqueue(new Uint8Array(row.data));
      if (idx >= chunkCount) controller.close();
    },
  });
}

/** A whole small copy at once (HTML pages, which get their links rewritten). */
export async function readChunks(id: string): Promise<Buffer> {
  const rows = await q<{ data: Buffer }>(`select data from snapshot_chunks where snapshot_id = $1 order by idx`, [id]);
  return Buffer.concat(rows.map((r) => r.data));
}

export const publicFileUrl = (id: string, download = false) => `/api/public/files/${id}${download ? "?download" : ""}`;
