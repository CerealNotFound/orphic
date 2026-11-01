-- Removing a teammate's access keeps their saves and ratings but blocks the bot, web and API keys.
alter table members add column disabled_at timestamptz;
