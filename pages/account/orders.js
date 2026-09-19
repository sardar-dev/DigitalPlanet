import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

const STATUS_LABEL = {
  pending_payment: "Waiting for payment",
  payment_submitted: "Verifying payment",
  paid: "Paid — fulfilling",
  fulfilling: "Fulfilling",
  delivered: "Delivered",
  failed: "Failed — refund pending",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export default function Orders() {
  const [orders, setOrders] = useState(null);

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
      .select("*, products(title)")
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
      <header className="border-b border-line">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-baseline justify-between gap-2">
          <Link href="/" className="font-display text-2xl">
            Ledger Stock
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
              {o.status === "pending_payment" && (
                <button
                  onClick={() => cancelOrder(o.id)}
                  className="text-xs underline text-signal mt-2"
                >
                  Cancel order
                </button>
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
