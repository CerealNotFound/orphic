-- Private saved copies of linked resources (Google Docs as PDF, Drive files, page text), so the team keeps
-- access even if the creator later revokes the link. Stored in Postgres in chunks (no extra storage service).
create table snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  job_id bigint references jobs(id) on delete set null,
  capture_id uuid references captures(id) on delete cascade,
  kind text not null check (kind in ('original', 'pdf', 'text')),
  filename text not null,
  content_type text not null,
  size_bytes bigint not null default 0,
  chunk_count int not null default 0,
  complete boolean not null default false,
  source_url text,
  created_at timestamptz not null default now()
);
create index snapshots_capture_idx on snapshots (capture_id);
create index snapshots_job_idx on snapshots (job_id);

create table snapshot_chunks (
  snapshot_id uuid not null references snapshots(id) on delete cascade,
  idx int not null,
  data bytea not null,
  primary key (snapshot_id, idx)
);
