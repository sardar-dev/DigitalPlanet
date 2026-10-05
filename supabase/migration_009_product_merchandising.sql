-- Run this in Supabase SQL Editor.
--
-- Adds lightweight merchandising fields to `products`, used by both
-- DigiTrust and manual products:
--
-- 1. image_url          — admin pastes a link to an already-hosted
--                          image/logo (no Supabase Storage, no file
--                          upload, no extra bandwidth/storage usage).
-- 2. category            — free-text tag (e.g. "Streaming", "AI
--                          Tools"), used to build filter tabs on the
--                          homepage from data we already fetch — no
--                          new query, no new table.
-- 3. featured            — admin can pin a product to show first.
-- 4. low_stock_threshold — per-product "low stock" warning cutoff
--                          (falls back to the existing hardcoded 3 if
--                          null, so every existing row keeps working
--                          with no behavior change until an admin
--                          sets one).
-- 5. short_description   — a short tagline for the product grid card,
--                          separate from the longer `description`
--                          shown in the Buy modal (falls back to
--                          `description` if not set).
--
-- All nullable with safe defaults — purely additive, no existing data
-- touched, no new table, no new Supabase Storage/Realtime usage.

alter table public.products
  add column if not exists image_url text,
  add column if not exists category text,
  add column if not exists featured boolean not null default false,
  add column if not exists low_stock_threshold integer,
  add column if not exists short_description text;

do $$ begin
  alter table public.products
    add constraint products_low_stock_threshold_check
    check (low_stock_threshold is null or low_stock_threshold >= 0);
exception when duplicate_object then null; end $$;

-- Lets the storefront filter by category without a full table scan
-- once there are many products; harmless and cheap even with few.
create index if not exists products_category_idx on public.products (category);
