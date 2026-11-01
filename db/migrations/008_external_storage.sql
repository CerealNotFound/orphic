-- Large saved files (audio packs, big PDFs) live in external storage (Cloudinary, private) instead of Postgres chunks.
alter table snapshots add column storage text not null default 'db' check (storage in ('db', 'cloudinary'));
alter table snapshots add column external jsonb;
