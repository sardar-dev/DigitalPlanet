-- Run this in Supabase SQL Editor.
--
-- 1. products.activation_field ('email' | 'username' | null) — for a
--    manual product, what info the customer must provide at checkout
--    for the admin to activate their subscription/account. Drives
--    the checkout box's label/placeholder directly (no free-text
--    admin field needed — the choice IS the placeholder).
-- 2. orders.activation_info — whatever the customer actually typed
--    into that box (their email or username), shown to the admin in
--    the manual-delivery view.
-- 3. orders.order_number — a short, human-friendly sequential number
--    (e.g. #1000) for support reference, instead of making customers
--    read out a long UUID. Existing orders are backfilled
--    automatically when this column is added.

alter table public.products
  add column if not exists activation_field text;

do $$ begin
  alter table public.products
    add constraint products_activation_field_check
    check (activation_field is null or activation_field in ('email', 'username'));
exception when duplicate_object then null; end $$;

alter table public.orders
  add column if not exists activation_info text;

create sequence if not exists public.order_number_seq start with 1000 increment by 1;

alter table public.orders
  add column if not exists order_number bigint default nextval('public.order_number_seq');

create unique index if not exists orders_order_number_idx on public.orders (order_number);
