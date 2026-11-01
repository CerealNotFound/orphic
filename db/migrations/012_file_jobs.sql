-- Documents uploaded to the bot (PDF, Word, text files) are their own job and capture kind: "file".
alter table jobs drop constraint if exists jobs_kind_check;
alter table jobs add constraint jobs_kind_check check (kind in ('reel', 'link', 'image', 'text', 'file'));
alter table captures drop constraint if exists captures_kind_check;
alter table captures add constraint captures_kind_check check (kind in ('reel', 'link', 'image', 'text', 'file'));
