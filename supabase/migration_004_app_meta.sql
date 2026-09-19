-- Small key/value table used to show "last synced at" in the admin
-- dashboard. Run in Supabase SQL Editor if upgrading an existing DB.

create table if not exists public.app_meta (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.app_meta enable row level security;
-- no policies = service role only, no client access.
