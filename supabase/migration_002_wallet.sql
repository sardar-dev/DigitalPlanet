-- Run this in Supabase SQL Editor if you already ran schema.sql once
-- before (adds the wallet balance system + new order fields without
-- touching your existing data).

alter table public.profiles
  add column if not exists balance numeric not null default 0;

alter table public.orders
  add column if not exists paid_with text not null default 'onchain';

create table if not exists public.wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  tx_hash text not null unique,
  amount numeric not null,
  status text not null default 'credited',
  created_at timestamptz not null default now()
);

alter table public.wallet_topups enable row level security;

drop policy if exists "wallet_topups: user can read own topups" on public.wallet_topups;
create policy "wallet_topups: user can read own topups"
  on public.wallet_topups for select
  using (auth.uid() = user_id);

create index if not exists wallet_topups_user_id_idx on public.wallet_topups (user_id);
