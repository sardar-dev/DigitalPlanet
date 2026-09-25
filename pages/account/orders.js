import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import PaymentPanel from "../../components/PaymentPanel";
import SEO from "../../components/SEO";
import { SITE_NAME } from "../../lib/siteConfig";

const STATUS_LABEL = {
  pending_payment: "Waiting for payment",
  payment_submitted: "Verifying payment",
  paid: "Paid — fulfilling",
  fulfilling: "Fulfilling",
  awaiting_manual_fulfillment: "Awaiting manual delivery",
  delivered: "Delivered",
  failed: "Failed — refund pending",
  refunded: "Refunded",
  cancelled: "Cancelled",
  needs_reconciliation: "Confirming delivery — hang tight",
};

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [resuming, setResuming] = useState(null); // order id being resumed

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = "/login";
      return;
    }
    const { data } = await supabase
      .from("orders")
      .select("*, products(title, provider, delivery)")
      .order("created_at", { ascending: false });
    setOrders(data || []);
  }

  async function cancelOrder(id) {
    await fetch("/api/orders/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: id }),
    });
    load();
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      <SEO title="My orders" path="/account/orders" noindex />
      <header className="border-b border-line">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-baseline justify-between gap-2">
          <Link href="/" className="font-display text-2xl">
            {SITE_NAME}
          </Link>
          <nav className="text-sm space-x-5">
            <Link href="/account/wallet" className="hover:underline">
              Wallet
            </Link>
            <span>My orders</span>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {!orders && <p className="text-sm">Loading…</p>}
        {orders && orders.length === 0 && (
          <p className="text-sm text-wire">No orders yet.</p>
        )}
        <ul className="divide-y divide-line border-t border-b border-line">
          {(orders || []).map((o) => (
            <li key={o.id} className="py-4">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-display text-base">
                  {o.products?.title || `Product #${o.product_id}`} × {o.quantity}
                </span>
                <span className="font-mono">${Number(o.total).toFixed(2)}</span>
              </div>
              <div className="text-xs text-wire mt-1">
                {STATUS_LABEL[o.status] || o.status} ·{" "}
                {new Date(o.created_at).toLocaleString()}
              </div>
              {o.status === "awaiting_manual_fulfillment" && o.products?.delivery && (
                <div className="text-xs text-wire mt-1">
                  Estimated delivery: {o.products.delivery}
                </div>
              )}

              {o.status === "pending_payment" && resuming !== o.id && (
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setResuming(o.id)}
                    className="text-xs underline"
                  >
                    Continue payment
                  </button>
                  <button
                    onClick={() => cancelOrder(o.id)}
                    className="text-xs underline text-signal"
                  >
                    Cancel order
                  </button>
                </div>
              )}

              {o.status === "pending_payment" && resuming === o.id && (
                <div className="mt-3 border border-line p-4 bg-white">
                  <PaymentPanel
                    order={o}
                    onDone={() => {
                      setResuming(null);
                      load();
                    }}
                  />
                  <button
                    onClick={() => setResuming(null)}
                    className="text-xs underline text-wire mt-3"
                  >
                    Close
                  </button>
                </div>
              )}

              {o.status === "delivered" && o.items?.length > 0 && (
                <pre className="mt-2 bg-white border border-line p-3 text-xs whitespace-pre-wrap font-mono break-all">
                  {o.items.join("\n")}
                </pre>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
