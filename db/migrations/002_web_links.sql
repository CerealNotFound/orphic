-- One-time links from Telegram (/web) that tie a teammate's Google sign-in to their member record.
create table link_tokens (
  token text primary key,
  member_id uuid not null references members(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
-- The Better Auth user id a member signed in with (email may differ in case).
alter table members add column auth_user_id text unique;
