import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import PaymentPanel from "../components/PaymentPanel";
import SEO from "../components/SEO";
import { SITE_NAME, SITE_TAGLINE } from "../lib/siteConfig";

// Server-rendered so search engines (and the first paint) see the
// actual product list immediately, not an empty page that fills in
// after a client-side fetch.
export async function getServerSideProps() {
  const { data } = await supabaseAdmin
    .from("products")
    .select(
      "id, title, description, sell_price, available_stock, requires_email, delivery, provider, updated_at"
    )
    .eq("selected", true)
    .gt("available_stock", 0)
    .order("title", { ascending: true });

  return { props: { initialProducts: data || [] } };
}

export default function Storefront({ initialProducts }) {
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState(initialProducts || []);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [active, setActive] = useState(null); // product being purchased
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    // Quiet background refresh — we already have server-rendered data
    // to show, this just keeps stock/price current without a loading
    // flash. Falls back to a visible error only if we truly have
    // nothing to show.
    loadProducts(products.length === 0);
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadProducts(showLoadingState = true) {
    if (showLoadingState) setLoading(true);
    setLoadError(false);
    fetch("/api/products")
      .then((r) => {
        if (!r.ok) throw new Error("bad_status");
        return r.json();
      })
      .then((d) => {
        if (!d.success) throw new Error("bad_response");
        setProducts(d.products || []);
      })
      .catch(() => {
        if (products.length === 0) setLoadError(true);
      })
      .finally(() => setLoading(false));
  }

  // Filtering happens entirely in the browser — no extra requests to
  // our server per keystroke, since we already have the full list.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  return (
    <div className="min-h-screen bg-paper text-ink font-body flex flex-col">
      <SEO />
      <header className="border-b border-line">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-display text-2xl">{SITE_NAME}</span>
          <nav className="text-sm space-x-4 sm:space-x-5">
            {session ? (
              <>
                <Link href="/account/wallet" className="hover:underline">
                  Wallet
                </Link>
                <Link href="/account/orders" className="hover:underline">
                  My orders
                </Link>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="hover:underline"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:underline">
                  Log in
                </Link>
                <Link href="/signup" className="hover:underline">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        <h1 className="font-display text-xl mb-2">{SITE_NAME}</h1>
        <p className="text-sm text-wire mb-6 max-w-md">
          {SITE_TAGLINE}. Every item here is confirmed in stock right now — pay
          with USDT (BEP20) and delivery happens automatically once your
          transaction is confirmed on-chain.
        </p>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="w-full mb-6 border border-line px-3 py-2 bg-paper text-sm"
        />

        {loading && products.length === 0 && <p className="text-sm">Loading stock…</p>}
        {loadError && (
          <div className="text-sm text-signal space-y-2">
            <p>Couldn't load products right now — something's wrong on our end.</p>
            <button onClick={() => loadProducts(true)} className="underline">
              Try again
            </button>
          </div>
        )}
        {!loading && !loadError && products.length === 0 && (
          <p className="text-sm text-wire">Nothing in stock right now — check back soon.</p>
        )}
        {!loading && !loadError && products.length > 0 && visible.length === 0 && (
          <p className="text-sm text-wire">No products match "{search}".</p>
        )}

        <ul className="divide-y divide-line border-t border-b border-line">
          {visible.map((p) => (
            <li
              key={p.id}
              className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="font-display text-lg">{p.title}</div>
                {p.description && (
                  <div className="text-sm text-wire mt-1">{p.description}</div>
                )}
                {p.provider === "manual" && (
                  <div className="text-xs mt-1">
                    <span className="inline-block border border-line px-2 py-0.5">
                      Manual delivery — {p.delivery || "see details"}
                    </span>
                  </div>
                )}
                <div className="text-xs font-mono text-wire mt-1">
                  {p.available_stock} available
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-lg">${Number(p.sell_price).toFixed(2)}</span>
                <button
                  onClick={() =>
                    session ? setActive(p) : (window.location.href = "/login")
                  }
                  className="px-4 py-2 bg-ink text-paper text-sm hover:bg-wire transition-colors"
                >
                  Buy
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>

      <footer className="border-t border-line mt-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-xs text-wire flex flex-wrap gap-x-4 gap-y-1">
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
          <Link href="/terms" className="hover:underline">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
        </div>
      </footer>

      {active && (
        <BuyModal product={active} onClose={() => setActive(null)} />
      )}
    </div>
  );
}

function BuyModal({ product, onClose }) {
  const [step, setStep] = useState("form"); // form | summary | order | done
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [items, setItems] = useState(null);
  const [manual, setManual] = useState(false);
  const [creating, setCreating] = useState(false);

  function reviewOrder() {
    setError("");
    if (product.requires_email && !email) {
      setError(describeError("email_required"));
      return;
    }
    setStep("summary");
  }

  async function confirmOrder() {
    setError("");
    setCreating(true);
    const res = await fetch("/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id, quantity, email }),
    });
    const data = await res.json();
    setCreating(false);
    if (!data.success) {
      setError(describeError(data.error, data.available));
      setStep("form");
      return;
    }
    setOrder(data.order);
    setStep("order");
  }

  const total = (Number(product.sell_price) * quantity).toFixed(2);

  return (
    <div className="fixed inset-0 bg-ink/60 flex items-center justify-center p-4">
      <div className="bg-paper max-w-md w-full p-6 border border-line max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="font-display text-xl">{product.title}</h2>
          <button onClick={onClose} className="text-sm text-wire hover:text-ink">
            Close
          </button>
        </div>

        {step === "form" && (
          <div className="space-y-4">
            {product.provider === "manual" && (
              <p className="text-xs border border-line p-3 bg-white">
                This product is delivered manually. Estimated delivery:{" "}
                <strong>{product.delivery || "see details"}</strong>. You'll find it in{" "}
                <strong>My Orders</strong> once it's ready.
              </p>
            )}
            <label className="block text-sm">
              Quantity
              <input
                type="number"
                min={1}
                max={product.available_stock}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full mt-1 border border-line px-3 py-2 bg-paper"
              />
            </label>
            {product.requires_email && (
              <label className="block text-sm">
                Email for delivery
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mt-1 border border-line px-3 py-2 bg-paper"
                />
              </label>
            )}
            {error && <p className="text-sm text-signal">{error}</p>}
            <button
              onClick={reviewOrder}
              className="w-full py-2 bg-ink text-paper hover:bg-wire transition-colors"
            >
              Review order
            </button>
          </div>
        )}

        {step === "summary" && (
          <div className="space-y-4 text-sm">
            <div className="border border-line divide-y divide-line">
              <div className="flex justify-between p-3">
                <span>Product</span>
                <span className="text-right">{product.title}</span>
              </div>
              <div className="flex justify-between p-3">
                <span>Quantity</span>
                <span className="font-mono">{quantity}</span>
              </div>
              <div className="flex justify-between p-3">
                <span>Unit price</span>
                <span className="font-mono">${Number(product.sell_price).toFixed(2)}</span>
              </div>
              {product.requires_email && (
                <div className="flex justify-between p-3">
                  <span>Delivery email</span>
                  <span className="text-right break-all">{email}</span>
                </div>
              )}
              {product.provider === "manual" && (
                <div className="flex justify-between p-3">
                  <span>Delivery</span>
                  <span className="text-right">Manual — {product.delivery || "see details"}</span>
                </div>
              )}
              <div className="flex justify-between p-3 font-display text-base">
                <span>Total</span>
                <span className="font-mono">${total}</span>
              </div>
            </div>
            {error && <p className="text-signal">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setStep("form")}
                className="flex-1 py-2 border border-line text-sm"
              >
                Back
              </button>
              <button
                onClick={confirmOrder}
                disabled={creating}
                className="flex-1 py-2 bg-ink text-paper hover:bg-wire transition-colors disabled:opacity-40"
              >
                {creating ? "Creating…" : "Confirm & continue"}
              </button>
            </div>
          </div>
        )}

        {step === "order" && order && (
          <PaymentPanel
            order={order}
            onDone={(result) => {
              setItems(result.items);
              setManual(result.manual);
              setStep("done");
            }}
          />
        )}

        {step === "done" && manual && (
          <div className="space-y-3 text-sm">
            <p>
              Payment confirmed. This product is delivered manually — estimated delivery{" "}
              <strong>{product.delivery || "soon"}</strong>. Check{" "}
              <Link href="/account/orders" className="underline">
                My Orders
              </Link>{" "}
              once it's ready.
            </p>
            <button onClick={onClose} className="w-full py-2 bg-ink text-paper">
              Done
            </button>
          </div>
        )}

        {step === "done" && !manual && (
          <div className="space-y-3 text-sm">
            <p>Delivered. Save these now:</p>
            <pre className="bg-white border border-line p-3 text-xs whitespace-pre-wrap font-mono break-all">
              {(items || []).join("\n")}
            </pre>
            <button onClick={onClose} className="w-full py-2 bg-ink text-paper">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
function describeError(code, available) {
  switch (code) {
    case "not_enough_stock":
      return `Only ${available} left — lower the quantity and try again.`;
    case "email_required":
      return "This product needs an email address for delivery.";
    default:
      return code ? code.replaceAll("_", " ") : "Something went wrong.";
  }
}
