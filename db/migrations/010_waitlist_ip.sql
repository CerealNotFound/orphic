-- Salted hash of the signup IP (never the raw IP), only to rate-limit the public waitlist form.
alter table waitlist add column ip_hash text;
create index waitlist_ip_idx on waitlist (ip_hash, created_at);
