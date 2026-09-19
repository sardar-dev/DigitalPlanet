# Ledger Stock — DigiTrust reseller storefront

A single-reseller storefront on top of the DigiTrust bot API. You pick
which DigiTrust products are shown, customers pay in USDT (BEP20) and
delivery happens automatically once the payment is confirmed on-chain.

## How it works

1. **Stock sync** (`/api/admin/sync`, run every 5 min by Vercel Cron)
   pulls all your DigiTrust products, subtracts `STOCK_BUFFER` (default
   2) from the real stock, and saves the result into Supabase. This is
   what the storefront reads — never live DigiTrust calls per visitor.
2. **Admin panel** (`/admin`) — tick which synced products should
   appear on the site, and set your own sell price per product.
3. **Checkout**:
   - `POST /api/orders/create` — creates a `pending_payment` order,
     after a *live* re-check of DigiTrust stock (not just the cache).
   - Customer sends USDT (BEP20) to your wallet, submits the tx hash.
   - `POST /api/orders/verify-payment` — looks the tx up on BscScan,
     confirms it paid the right wallet, the right amount, and has
     enough confirmations, then immediately calls DigiTrust's
     `/purchase` and stores the delivered items on the order.
4. **Orders** are visible to the customer at `/account/orders` and to
   you at `/admin` (Orders tab), including manual "mark refunded" for
   the rare case DigiTrust sells out in the few seconds between
   payment and fulfillment.

## Setup

### 1. Supabase
- Create a project at supabase.com.
- SQL Editor → paste and run `supabase/schema.sql`.
- Auth → disable "Confirm email" if you want instant signup, or leave
  it on (default) to require email confirmation.
- To make your own account an admin, after signing up once on the
  site, run in SQL Editor:
  ```sql
  update public.profiles set is_admin = true where email = 'you@example.com';
  ```
- Copy your Project URL, anon key, and service_role key into `.env.local`.

### 2. DigiTrust
- Get your reseller API key from the DigiTrust bot.
- Set `DIGITRUST_API_BASE` and `DIGITRUST_API_KEY`.

### 3. USDT (BEP20) payments
- Set `PAYOUT_WALLET_ADDRESS` to your BEP20 wallet.
- Get a free API key at etherscan.io/apis (**not** bscscan.com — that
  standalone API was deprecated in August 2025), set `ETHERSCAN_API_KEY`.
  The same key works for BSC because it's now a unified multichain API.
- Leave `BSC_USDT_CONTRACT` as-is (it's USDT's real BEP20 contract).

### 4. Local dev
```bash
cp .env.example .env.local   # then fill in the values above
npm install
npm run dev
```

### 5. Deploy
- Push this repo to GitHub.
- Import it into Vercel.
- Add every variable from `.env.example` in Vercel → Settings →
  Environment Variables (including `CRON_SECRET` — any long random
  string; Vercel Cron will send it automatically once the env var
  exists).
- Vercel Hobby plan only allows one cron run per day, so
  `vercel.json` runs `/api/admin/sync` once daily (midnight UTC).
  That only affects how fresh the *displayed* stock/price numbers
  are — checkout always re-checks live DigiTrust stock before taking
  payment and again right before the real purchase, so this never
  risks overselling.
  - Whenever you change stock/prices on DigiTrust and want the site
    to reflect it sooner, either wait for the next daily sync, or
    trigger it manually any time:
    `curl -H "x-cron-secret: YOUR_CRON_SECRET" https://yoursite.vercel.app/api/admin/sync`
  - If you later want automatic syncing more than once a day without
    upgrading to Vercel Pro, point a free external scheduler (e.g.
    cron-job.org) at that same URL with an `x-cron-secret` header —
    no code changes needed.
- Log in to `/admin`, tick the products you want to sell, set prices.

## Notes / things worth knowing

- **Stock safety buffer**: `STOCK_BUFFER=2` means a DigiTrust product
  with 5 in stock shows as 3 available. Checkout also re-checks live
  DigiTrust stock at order-creation time and again right before the
  real purchase, so the buffer is a cushion, not the only protection.
- **One purchase at a time**: DigiTrust's API only allows one purchase
  in flight per key, which is an extra layer against two people buying
  the last unit simultaneously.
- **Payment matching**: since BEP20 transfers have no memo field,
  matching relies on the tx hash the customer submits plus checking
  the amount/recipient on-chain. A tx hash can only be used once
  across all orders.
- **Refunds** are manual by design — if DigiTrust sells out between
  payment and fulfillment (rare), the order is marked `failed` and you
  refund the USDT by hand, then mark it `refunded` in `/admin`.
- **Domain**: not wired up yet — once you buy one, add it in Vercel →
  Settings → Domains.
