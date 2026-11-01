-- Orphic core schema.
-- Every content row carries workspace_id so the app can be multi-team later.

create extension if not exists vector;
create extension if not exists pg_trgm;

-- Teams --------------------------------------------------------------------

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  telegram_group_chat_id bigint,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  display_name text not null,
  email text,
  -- One Telegram account maps to one workspace for now (keeps bot routing simple).
  telegram_user_id bigint unique,
  telegram_username text,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table invites (
  code text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_by uuid references members(id) on delete set null,
  max_uses int not null default 50,
  uses int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  name text not null,
  prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Knowledge ----------------------------------------------------------------

-- A tool / workflow / prompt pack / template: the thing people actually want to find.
create table entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null default 'tool'
    check (kind in ('tool', 'workflow', 'prompt', 'template', 'repo', 'course', 'resource', 'other')),
  name text not null,
  slug text not null,
  aliases text[] not null default '{}',
  canonical_url text,
  domain text,
  summary text not null default '',
  use_cases text[] not null default '{}',
  category text not null default 'other',
  tags text[] not null default '{}',
  pricing text,
  is_creator_owned boolean not null default false,
  creator_handle text,
  link_status text not null default 'unverified'
    check (link_status in ('verified', 'unverified', 'pending_dm', 'none')),
  -- Name + aliases, for fuzzy (trigram) matching on tool names.
  names_text text not null default '',
  -- Everything searchable about the entity, incl. snippets from linked captures (app-maintained).
  search_doc text not null default '',
  search_tsv tsvector generated always as (to_tsvector('english', search_doc)) stored,
  save_count int not null default 0,
  rating_score int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);
create index entities_ws_idx on entities (workspace_id, updated_at desc);
create index entities_tsv_idx on entities using gin (search_tsv);
create index entities_names_trgm_idx on entities using gin (names_text gin_trgm_ops);
create index entities_domain_idx on entities (workspace_id, domain);
create index entities_tags_idx on entities using gin (tags);

create table entity_embeddings (
  entity_id uuid primary key references entities(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  model text not null,
  dim int not null,
  embedding halfvec(1024) not null,
  content_hash text not null,
  updated_at timestamptz not null default now()
);

-- One forwarded reel / link / screenshot. Raw evidence, kept as-is.
create table captures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('reel', 'link', 'image', 'text')),
  source_url text,
  source_key text,           -- reel shortcode or normalized URL; used for dedup
  creator_handle text,
  caption text,
  transcript text,
  ocr_text text,
  comments_excerpt text,
  language text,
  archived_content text,     -- copy of the destination page for DM links
  status text not null default 'ok'
    check (status in ('ok', 'pending_dm', 'unresolved', 'needs_user')),
  confidence real,
  summary text,
  created_at timestamptz not null default now(),
  unique (workspace_id, source_key)
);
create index captures_ws_idx on captures (workspace_id, created_at desc);

create table capture_entities (
  capture_id uuid not null references captures(id) on delete cascade,
  entity_id uuid not null references entities(id) on delete cascade,
  role text not null default 'primary' check (role in ('primary', 'mentioned', 'alternative')),
  primary key (capture_id, entity_id)
);
create index capture_entities_entity_idx on capture_entities (entity_id);

-- Who saved what. Duplicates add a save, not a new capture.
create table saves (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  capture_id uuid not null references captures(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (capture_id, member_id)
);
create index saves_member_idx on saves (member_id, created_at desc);

create table ratings (
  entity_id uuid not null references entities(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  comment text,
  created_at timestamptz not null default now(),
  primary key (entity_id, member_id)
);

-- "Comment X on the reel to get the link" and other things waiting on a person.
create table tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  capture_id uuid references captures(id) on delete cascade,
  entity_id uuid references entities(id) on delete cascade,
  kind text not null check (kind in ('comment_for_link', 'needs_user')),
  keyword text,
  instructions text,
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  last_reminded_at timestamptz,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index tasks_member_open_idx on tasks (member_id) where status = 'open';

-- Processing queue -----------------------------------------------------------

create table jobs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  kind text not null check (kind in ('reel', 'link', 'image', 'text')),
  input jsonb not null,      -- { url?, note?, telegram_file_id?, text? }
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'needs_input', 'done', 'failed')),
  attempts int not null default 0,
  question jsonb,            -- { text, options[] } while waiting on the user
  answer text,
  error text,
  result jsonb,
  capture_id uuid references captures(id) on delete set null,
  telegram_chat_id bigint,
  telegram_message_id bigint,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_queue_idx on jobs (status, created_at) where status in ('queued', 'processing');
create index jobs_ws_idx on jobs (workspace_id, created_at desc);
