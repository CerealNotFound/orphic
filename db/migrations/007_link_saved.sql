-- "saved": no public link, but the content itself (pasted guide, PDF, screenshot) is stored in Orphic.
alter table entities drop constraint entities_link_status_check;
alter table entities add constraint entities_link_status_check
  check (link_status in ('verified', 'unverified', 'pending_dm', 'saved', 'unavailable', 'none'));
