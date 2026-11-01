-- The open catalogue. `public_items` is the ONLY thing public routes read: our own text, facts and official links.
-- Never creators' content (captions, transcripts, saved copies), never teammates, never jobs or tasks.
alter table entities add column if not exists visibility text not null default 'auto'
  check (visibility in ('auto', 'public', 'hidden'));

create or replace view public_items as
  select e.id, e.workspace_id, e.slug, e.name, e.kind, e.category, e.tags, e.summary, e.use_cases, e.pricing,
         e.canonical_url as url, e.domain, e.save_count, e.rating_score, e.created_at, e.updated_at,
         e.search_tsv, e.names_text
  from entities e
  where e.visibility <> 'hidden'
    and e.link_status = 'verified'
    and e.canonical_url is not null
    and length(e.summary) > 40;
