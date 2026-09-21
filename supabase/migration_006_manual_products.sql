-- Run this in Supabase SQL Editor. Adds lightweight support for
-- admin-managed "manual" products alongside existing DigiTrust
-- products — no new hosting, no background workers, no queues.
--
-- Design notes:
--  - Only ONE new column on products: `provider` ('digitrust' |
--    'manual'). Everything else (title, description, cost_price,
--    sell_price, real_stock/available_stock, requires_email,
--    `delivery` — reused as "estimated delivery time" text,
--    `selected` — reused as active/inactive) already existed.
--  - Manual product IDs are always NEGATIVE (DigiTrust IDs are always
--    positive), generated from a sequence, so they can never collide
--    with a DigiTrust product id.
--  - Stock is decremented atomically, in a single UPDATE statement,
--    ONLY at the moment payment is confirmed (not reserved at order
--    creation) — this needs no background cron/expiry job and can't
--    go negative or double-sell the last unit under concurrent
--    requests.
--  - Both new SECURITY DEFINER functions have EXECUTE revoked from
--    public/anon/authenticated and granted only to service_role,
--    same pattern as migration_005.

alter table public.products
  add column if not exists provider text not null default 'digitrust';

do $$ begin
  alter table public.products
    add constraint products_provider_check check (provider in ('digitrust', 'manual'));
exception when duplicate_object then null; end $$;

-- Negative-only IDs for manual products.
create sequence if not exists public.manual_product_id_seq start with 1 increment by 1;

create or replace function public.next_manual_product_id()
returns bigint
language sql
security definer
as $$
  select -nextval('public.manual_product_id_seq');
$$;

revoke all on function public.next_manual_product_id() from public, anon, authenticated;
grant execute on function public.next_manual_product_id() to service_role;

-- Atomic manual-stock decrement, only at payment-confirmation time.
-- Returns the new stock level, or NULL if there wasn't enough stock
-- (or the product isn't a manual product) — the same "null means no,
-- nothing happened" pattern as decrement_balance_if_enough.
create or replace function public.decrement_manual_stock(p_product_id bigint, p_quantity integer)
returns integer
language plpgsql
security definer
as $$
declare v_new_stock integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be a positive integer';
  end if;

  update public.products
  set available_stock = available_stock - p_quantity,
      real_stock = available_stock - p_quantity,
      updated_at = now()
  where id = p_product_id
    and provider = 'manual'
    and available_stock >= p_quantity
  returning available_stock into v_new_stock;

  return v_new_stock;
end;
$$;

revoke all on function public.decrement_manual_stock(bigint, integer) from public, anon, authenticated;
grant execute on function public.decrement_manual_stock(bigint, integer) to service_role;
