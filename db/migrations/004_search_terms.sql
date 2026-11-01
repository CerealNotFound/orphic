-- Other ways people might search for an item (synonyms, related phrasings, problems it solves),
-- written by Claude at save time. Makes keyword search understand meaning without an embedding service.
alter table entities add column search_terms text[] not null default '{}';
