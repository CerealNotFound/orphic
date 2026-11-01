// Private saved copies of linked resources, stored in Postgres in ≤3 MB chunks (fits any serverless body limit).
import { q, q1 } from "./db";

export const MAX_SNAPSHOT_BYTES = 25 * 1024 * 1024;
export const CHUNK_BYTES = 3 * 1024 * 1024;

export type SnapshotMeta = {
  id: string;
  capture_id: string | null;
  kind: "original" | "pdf" | "text";
  filename: string;
  content_type: string;
  size_bytes: string;
  source_url: string | null;
  created_at: string;
  part?: boolean;
  storage?: "db" | "cloudinary";
  external?: { public_id: string; resource_type: "image" | "video" | "raw"; format: string } | null;
};

export async function createSnapshot(
  workspaceId: string,
  jobId: number,
  m: { kind: string; filename: string; content_type: string; size_bytes: number; source_url?: string | null; cloudinary?: object | null; part?: boolean | null },
) {
  const job = await q1<{ capture_id: string | null }>(`select capture_id from jobs where id = $1 and workspace_id = $2`, [jobId, workspaceId]);
  if (!job) return null;
  const row = await q1<{ id: string }>(
    `insert into snapshots (workspace_id, job_id, capture_id, kind, filename, content_type, size_bytes, source_url, storage, external, complete, part)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
    [
      workspaceId, jobId, job.capture_id, m.kind, m.filename.slice(0, 200), m.content_type, m.size_bytes, m.source_url ?? null,
      m.cloudinary ? "cloudinary" : "db", m.cloudinary ?? null, Boolean(m.cloudinary), Boolean(m.part),
    ],
  );
  return row!.id;
}

export async function putChunk(workspaceId: string, snapshotId: string, idx: number, data: Buffer) {
  const ok = await q1(`select 1 from snapshots where id = $1 and workspace_id = $2 and not complete`, [snapshotId, workspaceId]);
  if (!ok) return false;
  await q(`insert into snapshot_chunks (snapshot_id, idx, data) values ($1, $2, $3) on conflict (snapshot_id, idx) do update set data = excluded.data`, [
    snapshotId,
    idx,
    data,
  ]);
  return true;
}

export async function finalizeSnapshot(workspaceId: string, snapshotId: string) {
  const row = await q1<{ n: string; bytes: string }>(
    `select count(*) as n, coalesce(sum(length(data)), 0) as bytes from snapshot_chunks c
     join snapshots s on s.id = c.snapshot_id where s.id = $1 and s.workspace_id = $2`,
    [snapshotId, workspaceId],
  );
  if (!row || Number(row.n) === 0) return false;
  await q(`update snapshots set complete = true, chunk_count = $2, size_bytes = $3 where id = $1`, [snapshotId, Number(row.n), Number(row.bytes)]);
  return true;
}

/** Called when a job completes: copies uploaded for the job belong to its capture. */
export async function attachJobSnapshots(jobId: number | string, captureId: string) {
  await q(`update snapshots set capture_id = $2 where job_id = $1 and capture_id is null`, [jobId, captureId]);
}

export async function snapshotsForCaptures(workspaceId: string, captureIds: string[]) {
  if (!captureIds.length) return [];
  return q<SnapshotMeta>(
    `select id, capture_id, kind, filename, content_type, size_bytes, source_url, created_at, part from snapshots
     where workspace_id = $1 and complete and capture_id = any($2) order by created_at`,
    [workspaceId, captureIds],
  );
}

export async function readSnapshot(workspaceId: string, id: string): Promise<{ meta: SnapshotMeta; data: Buffer | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const meta = await q1<SnapshotMeta>(
    `select id, capture_id, kind, filename, content_type, size_bytes, source_url, created_at, storage, external from snapshots where id = $1 and workspace_id = $2 and complete`,
    [id, workspaceId],
  );
  if (!meta) return null;
  if (meta.storage === "cloudinary") return { meta, data: null };
  const chunks = await q<{ data: Buffer }>(`select data from snapshot_chunks where snapshot_id = $1 order by idx`, [id]);
  return { meta, data: Buffer.concat(chunks.map((c) => c.data)) };
}

/**
 * The same copy as a stream, one stored chunk at a time. Copies kept in the database can be up to 25 MB, more than a
 * function may send in one buffered response, so they're always streamed.
 */
export async function streamSnapshot(workspaceId: string, id: string): Promise<{ meta: SnapshotMeta; body: ReadableStream<Uint8Array> | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const meta = await q1<SnapshotMeta & { chunk_count: number }>(
    `select id, capture_id, kind, filename, content_type, size_bytes, source_url, created_at, storage, external, chunk_count
     from snapshots where id = $1 and workspace_id = $2 and complete`,
    [id, workspaceId],
  );
  if (!meta) return null;
  if (meta.storage === "cloudinary") return { meta, body: null };
  let idx = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const row = await q1<{ data: Buffer }>(`select data from snapshot_chunks where snapshot_id = $1 and idx = $2`, [id, idx++]);
      if (!row) return controller.close();
      controller.enqueue(new Uint8Array(row.data));
      if (idx >= meta.chunk_count) controller.close();
    },
  });
  return { meta, body };
}

/** Removes a job's earlier copies of its capture (all but `keep`), e.g. after re-copying a site more completely. */
export async function pruneSnapshots(workspaceId: string, jobId: number, keep: string[]) {
  const job = await q1<{ capture_id: string | null }>(`select capture_id from jobs where id = $1 and workspace_id = $2`, [jobId, workspaceId]);
  if (!job?.capture_id) return null;
  const rows = await q<{ id: string }>(
    `delete from snapshots where workspace_id = $1 and capture_id = $2 and not (id = any($3::uuid[])) returning id`,
    [workspaceId, job.capture_id, keep],
  );
  return rows.length;
}

export const snapshotUrl = (appUrl: string, id: string) => `${appUrl}/api/snapshots/${id}`;
