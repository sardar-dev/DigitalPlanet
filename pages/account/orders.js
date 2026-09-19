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
};

export default function Orders() {
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      <header className="border-b border-line">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-baseline justify-between">
          <Link href="/" className="font-display text-2xl">
            Ledger Stock
          </Link>
          <span className="text-sm">My orders</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {!orders && <p className="text-sm">Loading…</p>}
        {orders && orders.length === 0 && (
          <p className="text-sm text-wire">No orders yet.</p>
        )}
        <ul className="divide-y divide-line border-t border-b border-line">
          {(orders || []).map((o) => (
            <li key={o.id} className="py-4">
              <div className="flex justify-between text-sm">
                <span className="font-display text-base">
                  {o.products?.title || `Product #${o.product_id}`} × {o.quantity}
                </span>
                <span className="font-mono">${Number(o.total).toFixed(2)}</span>
              </div>
              <div className="text-xs text-wire mt-1">
                {STATUS_LABEL[o.status] || o.status} ·{" "}
                {new Date(o.created_at).toLocaleString()}
              </div>
              {o.status === "delivered" && o.items?.length > 0 && (
                <pre className="mt-2 bg-white border border-line p-3 text-xs whitespace-pre-wrap font-mono">
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
