-- Run this once in the Supabase SQL editor for a fresh project.

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

-- auto-create a profile row whenever someone signs up
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
  -- | delivered | failed | refunded | cancelled

  payout_wallet text not null,
  expected_amount numeric not null,
  tx_hash text,

  digitrust_order_id bigint,
  items jsonb,                         -- delivered credentials, once fulfilled
  failure_reason text,
  paid_with text not null default 'onchain', -- 'onchain' | 'wallet_balance'

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "orders: user can read own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "orders: user can create own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);

-- ─────────────────────────────────────────────────────────────
-- wallet_topups: USDT (BEP20) deposits that credit a user's
-- store-credit balance, so they can check out instantly next time
-- without an on-chain wait per order.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  tx_hash text not null unique,        -- unique stops the same tx being credited twice
  amount numeric not null,
  status text not null default 'credited', -- credited | rejected
  created_at timestamptz not null default now()
);

alter table public.wallet_topups enable row level security;

create policy "wallet_topups: user can read own topups"
  on public.wallet_topups for select
  using (auth.uid() = user_id);

create index if not exists wallet_topups_user_id_idx on public.wallet_topups (user_id);
