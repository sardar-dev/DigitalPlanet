-- Run this in Supabase SQL Editor.
--
-- Unique-amount deposit invoices for wallet top-ups.
--
-- Problem this fixes: today, a customer sends USDT and pastes a tx
-- hash, and the server credits whatever amount it finds on-chain.
-- Anyone who can see a pending transfer to our payout wallet (it's a
-- public blockchain) could try to claim IT as their own top-up by
-- submitting its hash first. The existing used_tx_hashes table stops
-- the same hash being used twice, but it does nothing to stop a
-- stranger racing the real sender to submit the hash first.
--
-- Fix: before sending anything, the customer requests an invoice for
-- a round dollar amount (e.g. $10). We hand back a *unique* amount
-- (e.g. $10.0047) that no other active invoice currently uses, valid
-- for 30 minutes. They must send exactly that amount. We then only
-- credit a transaction whose on-chain amount matches an invoice the
-- CURRENT user themselves created — an attacker's own transaction
-- will never match the victim's invoice amount, and the victim's
-- transaction will never match an attacker's invoice amount, so
-- there's nothing to race.
--
-- No cron needed: expiry is enforced at lookup time (any invoice
-- whose expires_at has passed is simply treated as not-pending), and
-- the create-invoice endpoint opportunistically marks old ones
-- expired so the table doesn't accumulate stale "pending" rows that
-- could collide with new unique amounts.

create table if not exists public.wallet_deposit_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  requested_amount numeric not null check (requested_amount > 0),
  unique_amount numeric not null,
  status text not null default 'pending', -- pending | matched | expired | cancelled
  tx_hash text, -- set once matched
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.wallet_deposit_invoices enable row level security;

-- A user can see their own invoices (to resume/check status) but can
-- never insert/update one directly — that would let them set their
-- own unique_amount or mark their own invoice "matched". All writes
-- go through the service-role key inside /api/wallet/* routes.
create policy "deposit_invoices: user can read own invoices"
  on public.wallet_deposit_invoices for select
  using (auth.uid() = user_id);

-- Only one row can ever be the *active* claim on a given unique
-- amount at a time — this is what actually prevents two invoices
-- (even for two different users) from ever sharing a payable amount
-- while both are still pending.
create unique index if not exists wallet_deposit_invoices_active_amount_idx
  on public.wallet_deposit_invoices (unique_amount)
  where status = 'pending';

create index if not exists wallet_deposit_invoices_user_id_idx
  on public.wallet_deposit_invoices (user_id);
