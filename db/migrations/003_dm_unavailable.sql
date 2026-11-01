-- "The creator's DM never came": a closed wait. The item stays searchable, marked as unavailable.
alter table entities drop constraint entities_link_status_check;
alter table entities add constraint entities_link_status_check
  check (link_status in ('verified', 'unverified', 'pending_dm', 'unavailable', 'none'));
