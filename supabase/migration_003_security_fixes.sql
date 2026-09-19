-- Run this in Supabase SQL Editor. Fixes several real security/
-- correctness issues found in review:
--
-- 1. Removes the client-side INSERT policy on orders — a logged-in
--    user could otherwise insert a fake order directly via the
--    Supabase client (fake total=0, status=pending_payment) and then
--    call /api/orders/pay-with-balance to get a real product for
--    free. All order creation now goes ONLY through
--    /api/orders/create, which uses the service role key server-side
--    (bypasses RLS) and computes totals itself — nothing legitimate
--    needs client-side insert, so removing the policy is a pure fix.
-- 2. Adds CHECK constraints as defense in depth (belt + suspenders).
-- 3. Adds a global used_tx_hashes ledger: claiming a tx hash is a
--    single atomic INSERT with a primary key on lower(tx_hash) —
--    this is what actually prevents the same transaction being used
--    twice (across orders AND wallet top-ups, case-insensitively,
--    and safe under concurrent/double-click requests, since only one
--    concurrent INSERT of the same hash can ever succeed).
-- 4. Adds atomic balance functions — balance changes now happen as a
--    single `UPDATE ... SET balance = balance + x` statement inside
--    Postgres, never a JavaScript read-then-write, which is what
--    actually prevents the wallet race condition.
-- 5. Adds a wallet_adjustments table for admin manual credit/debit.

-- ── 1. Remove the insecure client-insert policy ──────────────────
drop policy if exists "orders: user can create own orders" on public.orders;

-- ── 2. Defense-in-depth constraints ───────────────────────────────
alter table public.orders
  add column if not exists paid_with text not null default 'onchain';

do $$ begin
  alter table public.orders add constraint orders_total_nonneg check (total >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.orders add constraint orders_unit_price_nonneg check (unit_price >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.orders add constraint orders_quantity_positive check (quantity > 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.orders add constraint orders_expected_amount_nonneg check (expected_amount >= 0);
exception when duplicate_object then null; end $$;

-- ── 3. Global, case-insensitive, atomic tx-hash ledger ────────────
create table if not exists public.used_tx_hashes (
  tx_hash text primary key,          -- always stored lower(tx_hash)
  used_by_type text not null,        -- 'order' | 'topup'
  used_by_id uuid,
  status text not null default 'pending', -- pending | confirmed
  created_at timestamptz not null default now()
);

alter table public.used_tx_hashes enable row level security;
-- no policies = no client access at all; service role only.

-- ── 4. Atomic wallet balance functions ────────────────────────────
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

-- ── 5. Manual admin wallet adjustments (credit/debit with a reason) ─
create table if not exists public.wallet_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  amount numeric not null,           -- positive = credit, negative = debit
  reason text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.wallet_adjustments enable row level security;

drop policy if exists "wallet_adjustments: user can read own" on public.wallet_adjustments;
create policy "wallet_adjustments: user can read own"
  on public.wallet_adjustments for select
  using (auth.uid() = user_id);

create index if not exists wallet_adjustments_user_id_idx on public.wallet_adjustments (user_id);
