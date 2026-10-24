-- =====================================================================================================
-- SITE SETTINGS (v4): owner-editable home pictures + social links.
-- Run this ONCE in the Supabase SQL editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- It is safe to run again: nothing is deleted or overwritten. The same block is also at the end of schema.sql.
-- =====================================================================================================
create table if not exists site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table site_settings enable row level security;

-- the website (anon key) may only READ these settings; all writes go through the owner dashboard (service role)
drop policy if exists "Public can read site settings" on site_settings;
create policy "Public can read site settings" on site_settings for select to anon, authenticated using (true);
revoke all on site_settings from anon, authenticated;
grant select on site_settings to anon, authenticated;
