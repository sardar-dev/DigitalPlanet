-- Run this once in the Supabase SQL editor for a fresh project.
-- (If you already ran an older version of this file, use the
-- numbered migration_*.sql files instead — they apply incrementally
-- without touching your existing data.)

-- ─────────────────────────────────────────────────────────────
-- profiles: one row per signed-up user (mirrors auth.users)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  balance numeric not null default 0,   -- USDT store-credit balance
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles: user can read own row"
  on public.profiles for select
  using (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- products: local cache of DigiTrust products, with our own
-- selection flag and (optional) markup price
-- ─────────────────────────────────────────────────────────────
create table if not exists public.products (
  id bigint primary key,              -- same id as DigiTrust product id
  title text not null,
  description text,
  cost_price numeric not null,        -- price DigiTrust charges us
  sell_price numeric not null,        -- price we charge the customer
  real_stock integer not null default 0,      -- raw DigiTrust stock
  available_stock integer not null default 0, -- after buffer applied
  requires_email boolean not null default false,
  delivery text default 'instant',
  selected boolean not null default false,    -- shown on storefront?
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "products: anyone can read selected+in-stock products"
  on public.products for select
  using (selected = true);

-- writes to products only ever happen via the service role key
-- (admin API routes / the sync cron), so no insert/update policy
-- is needed for normal users.

-- ─────────────────────────────────────────────────────────────
-- orders: one row per purchase attempt
--
-- IMPORTANT: there is deliberately NO insert policy here. All order
-- creation goes through /api/orders/create using the service role
-- key (bypasses RLS), which is what computes total/unit_price safely
-- server-side. If a client-side insert policy existed, a user could
-- insert a fake order (total=0) directly via the Supabase client and
-- then "pay" for it with a $0 wallet balance.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  product_id bigint not null references public.products(id),
  quantity integer not null default 1,
  unit_price numeric not null,
  total numeric not null,
  email text,                          -- only if product requires_email

  status text not null default 'pending_payment',
  -- pending_payment | payment_submitted | paid | fulfilling
  -- | delivered | failed | refunded | cancelled | needs_reconciliation

  payout_wallet text not null,
  expected_amount numeric not null,
  tx_hash text,
  paid_with text not null default 'onchain', -- 'onchain' | 'wallet_balance'

  digitrust_order_id bigint,
  items jsonb,                         -- delivered credentials, once fulfilled
  failure_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_total_nonneg check (total >= 0),
  constraint orders_unit_price_nonneg check (unit_price >= 0),
  constraint orders_quantity_positive check (quantity > 0),
  constraint orders_expected_amount_nonneg check (expected_amount >= 0)
);

alter table public.orders enable row level security;

create policy "orders: user can read own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);

-- ─────────────────────────────────────────────────────────────
-- wallet_topups: USDT (BEP20) deposits that credit a user's
-- store-credit balance.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  tx_hash text not null unique,
  amount numeric not null,
  status text not null default 'credited', -- credited | rejected
  created_at timestamptz not null default now()
);

alter table public.wallet_topups enable row level security;

create policy "wallet_topups: user can read own topups"
  on public.wallet_topups for select
  using (auth.uid() = user_id);

create index if not exists wallet_topups_user_id_idx on public.wallet_topups (user_id);

-- ─────────────────────────────────────────────────────────────
-- wallet_adjustments: manual admin credit/debit, with a reason,
-- for support cases (refunds, goodwill credit, correcting a mistake)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.wallet_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  amount numeric not null,           -- positive = credit, negative = debit
  reason text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.wallet_adjustments enable row level security;

create policy "wallet_adjustments: user can read own"
  on public.wallet_adjustments for select
  using (auth.uid() = user_id);

create index if not exists wallet_adjustments_user_id_idx on public.wallet_adjustments (user_id);

-- ─────────────────────────────────────────────────────────────
-- used_tx_hashes: a global, case-insensitive ledger of every USDT
-- transaction hash that's ever been claimed for an order payment or
-- a wallet top-up. Claiming a hash is a single atomic INSERT (the
-- primary key enforces uniqueness) — this is what actually prevents
-- the same transaction being used twice, including under concurrent
-- / double-click requests, since only one concurrent INSERT of the
-- same hash can ever succeed. No RLS policies = no client access at
-- all; only the service role touches this table.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.used_tx_hashes (
  tx_hash text primary key,          -- always stored lower(tx_hash)
  used_by_type text not null,        -- 'order' | 'topup'
  used_by_id uuid,
  status text not null default 'pending', -- pending | confirmed
  created_at timestamptz not null default now()
);

alter table public.used_tx_hashes enable row level security;

-- ─────────────────────────────────────────────────────────────
-- Atomic wallet balance functions — balance changes always happen as
-- a single `UPDATE ... SET balance = balance ± x` statement inside
-- Postgres (which is atomic per-row), never a JavaScript
-- read-then-write, which is what actually prevents the wallet race
-- condition under concurrent top-ups/purchases.
-- ─────────────────────────────────────────────────────────────
create or replace function public.increment_balance(p_user_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
as $$
declare v_new_balance numeric;
begin
  update public.profiles
  set balance = balance + p_amount
  where id = p_user_id
  returning balance into v_new_balance;
  return v_new_balance;
end;
$$;

create or replace function public.decrement_balance_if_enough(p_user_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
as $$
declare v_new_balance numeric;
begin
  update public.profiles
  set balance = balance - p_amount
  where id = p_user_id and balance >= p_amount
  returning balance into v_new_balance;
  return v_new_balance; -- null (no row matched) means insufficient balance
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- app_meta: small key/value table, currently just used to show
-- "last synced at" in the admin dashboard.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.app_meta (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.app_meta enable row level security;
-- no policies = service role only, no client access.
