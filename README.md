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
- No API key needed for payment verification — it reads transaction
  receipts directly from free public BNB Smart Chain RPC nodes.
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
  across all orders AND wallet top-ups.
- **Wallet balance**: customers can send USDT any time (not tied to
  an order) and credit their balance at `/account/wallet`. At
  checkout, if their balance covers the total, they get an instant
  "pay with balance" option instead of waiting on a fresh on-chain
  confirmation. This also cuts down how often you're hitting the
  Etherscan API — most orders after the first top-up don't need an
  on-chain lookup at all.
- **Order controls**: customers can cancel their own still-unpaid
  orders (`/account/orders`). Admins (`/admin` → Orders tab) can
  cancel, mark refunded, or permanently delete orders — delete is for
  junk/abandoned orders, not anything with real money attached (use
  cancel/refund for those so there's a record).
- **Debug payment tool** (`/admin` → Debug payment tab): paste any tx
  hash to see exactly what the on-chain lookup found — which env var
  is missing, how many transfers were seen for your wallet, wrong
  recipient, etc. Use this first whenever "payment verification isn't
  working."
- **Search**: both the storefront and the admin Products/Orders tables
  have a search box. Filtering happens entirely in the browser against
  data already fetched — no extra server requests per keystroke.
- **Reducing server load**: `/api/products` is cached at Vercel's edge
  for 30s (`Cache-Control: s-maxage=30`), so repeat storefront visits
  are served from cache instead of hitting Supabase every time.
  Sorting/searching/filtering all happen client-side against data
  already in the browser. None of this affects checkout safety — that
  always re-checks live DigiTrust stock regardless of any cache.
- **Refunds** are manual by design — if DigiTrust sells out between
  payment and fulfillment (rare), the order is marked `failed` and you
  refund the USDT (or wallet balance) by hand, then mark it `refunded`
  in `/admin`.
- **Domain**: not wired up yet — once you buy one, add it in Vercel →
  Settings → Domains.

## If you already ran schema.sql before this update

Run these in order in the SQL Editor (each is safe to run once, skips
anything already applied):
1. `supabase/migration_002_wallet.sql`
2. `supabase/migration_003_security_fixes.sql` — **run this one**,
   it closes a real security hole (see below).
3. `supabase/migration_004_app_meta.sql`

## Security fixes (read this if you're upgrading)

A review turned up several real issues, now fixed:

- **Fake orders via direct Supabase inserts**: the original schema
  had a client-side "insert your own order" RLS policy. A logged-in
  user could use the Supabase JS client directly (bypassing our
  `/api/orders/create` endpoint entirely) to insert an order with
  `total = 0`, then call `/api/orders/pay-with-balance` to get a real
  product for free. **Fix**: that policy is removed entirely —
  `migration_003` drops it. All order creation now goes only through
  our server route, which computes the total itself.
- **Tx hash reuse / case-sensitivity**: a transaction hash could
  previously be reused across an order and a wallet top-up, or
  claimed twice by simultaneous requests, and `0xABC...` vs
  `0xabc...` weren't recognized as the same hash. **Fix**: every hash
  is lowercased and claimed via a single atomic `INSERT` into a
  `used_tx_hashes` table (primary key = the hash) — only one
  concurrent request can ever win that insert, for any hash, anywhere
  in the app.
- **Double-click / concurrent double-fulfillment**: clicking "verify
  payment" twice quickly (or two parallel requests) could both pass
  the pending_payment check and both call DigiTrust's `/purchase`.
  **Fix**: claiming an order for processing is a single conditional
  `UPDATE ... WHERE status = 'pending_payment'` — a second concurrent
  request gets 0 rows back and bails out immediately.
- **Wallet balance race condition**: balance updates used to be
  read-then-write in JavaScript, which two simultaneous top-ups or
  purchases could race. **Fix**: balance changes now happen via
  `increment_balance` / `decrement_balance_if_enough` — single
  Postgres `UPDATE balance = balance ± x` statements, which Postgres
  itself serializes per row.
- **DigiTrust timeout ambiguity**: if the purchase call to DigiTrust
  times out, we don't actually know whether they processed it or not
  — blindly marking it "failed" (implying safe to refund) risked
  delivering the product AND refunding it. **Fix**: a genuine
  network/timeout error now marks the order `needs_reconciliation`
  instead of `failed`. Resolve these in `/admin` → Orders tab: "Check
  DigiTrust" shows DigiTrust's own recent order history so you can
  see whether it actually went through, then either "Mark delivered"
  (paste the real items) or "Mark failed" (safe to refund).

## Other additions

- **Resumable checkout**: if a customer closes the payment modal,
  refreshes, or loses connection mid-payment, `/account/orders` has a
  "Continue payment" button on any still-pending order — same payment
  panel (wallet balance, USDT deposit, copy address, QR code, tx hash
  verify), not just a dead end with only "Cancel".
- **Payment method choice**: checkout now explicitly asks "pay with
  wallet balance" vs "deposit USDT (BEP20)" instead of showing both
  mixed together.
- **Copy address + QR code**: the payout wallet address has a "Copy"
  button with a "Copied!" confirmation, and a scannable QR code.
- **Password reset / resend confirmation**: added to `/login` —
  "Forgot password" and "Resend confirmation email".
- **Signup message fixed**: only shows "check your email" if Supabase
  actually required confirmation (checks whether a session came back
  immediately) — no longer shows that message when email confirmation
  is disabled on your project.
- **Products failing to load** now shows "Couldn't load products —
  try again" instead of silently looking like an empty store.
- **Wallet ledger**: `/account/wallet` shows a full history — top-ups,
  admin adjustments, and what was spent on which order.
- **Admin dashboard**: DigiTrust balance always shown at the top (with
  a low-balance warning), last sync time, a "Sync products now"
  button (no more needing to hit the URL by hand — see below), an
  approximate sales/profit summary, and a manual wallet credit/debit
  tool with a required reason.
- **Auto-hide on price increase**: if DigiTrust raises a product's
  price since the last sync, it's automatically un-ticked (hidden
  from the storefront) so you don't sell at the old margin by
  accident. A price drop never auto-shows anything — that's still
  your call. Check `/admin` after a sync if you rely on a product
  that might have gone up in price.
- **About manually hitting the sync URL**: yes, it's safe to open
  `/api/admin/sync?secret=...` as often as you like (every hour, every
  few minutes, whatever) — it's just a read + upsert, no side effects
  beyond refreshing the cache. For automatic syncing without doing
  that by hand, either use the new "Sync products now" button in
  `/admin` → Dashboard whenever you think of it, or point a free
  external scheduler (cron-job.org) at that same URL — see the Vercel
  Hobby cron note above.
