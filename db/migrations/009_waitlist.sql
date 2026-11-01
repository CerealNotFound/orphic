-- Public "coming soon" page signups (not tied to any team).
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  note text,
  created_at timestamptz not null default now()
);
