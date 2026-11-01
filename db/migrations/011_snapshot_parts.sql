-- A full copy of a site (e.g. a Notion guide) is one main copy plus its files (images, videos, attachments).
-- Parts are listed under their main copy instead of as separate buttons.
alter table snapshots add column part boolean not null default false;
