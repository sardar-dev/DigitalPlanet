import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Admin() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("products");

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .single();
      if (!profile?.is_admin) {
        setChecking(false);
        return;
      }
      setAllowed(true);
      setChecking(false);
      loadProducts();
      loadOrders();
    })();
  }, []);

  async function loadProducts() {
    const res = await fetch("/api/admin/products");
    const data = await res.json();
    if (data.success) setProducts(data.products);
  }

  async function loadOrders() {
    const res = await fetch("/api/admin/orders");
    const data = await res.json();
    if (data.success) setOrders(data.orders);
  }

  async function updateProduct(id, patch) {
    await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    loadProducts();
  }

  async function setOrderStatus(id, status) {
    await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadOrders();
  }

  if (checking) return <p className="p-8 text-sm">Checking access…</p>;
  if (!allowed)
    return <p className="p-8 text-sm">This account doesn't have admin access.</p>;

  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      <header className="border-b border-line">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-baseline justify-between">
          <span className="font-display text-2xl">Admin</span>
          <nav className="text-sm space-x-5">
            <button
              onClick={() => setTab("products")}
              className={tab === "products" ? "underline" : ""}
            >
              Products
            </button>
            <button
              onClick={() => setTab("orders")}
              className={tab === "orders" ? "underline" : ""}
            >
              Orders
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {tab === "products" && (
          <table className="w-full text-sm border-t border-line">
            <thead>
              <tr className="text-left text-wire border-b border-line">
                <th className="py-2 pr-2">Product</th>
                <th className="py-2 pr-2">Real stock</th>
                <th className="py-2 pr-2">Shown as</th>
                <th className="py-2 pr-2">Your price</th>
                <th className="py-2 pr-2">Show on site</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-line">
                  <td className="py-2 pr-2">{p.title}</td>
                  <td className="py-2 pr-2 font-mono">{p.real_stock}</td>
                  <td className="py-2 pr-2 font-mono">{p.available_stock}</td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={p.sell_price}
                      onBlur={(e) =>
                        updateProduct(p.id, { sell_price: Number(e.target.value) })
                      }
                      className="w-24 border border-line px-2 py-1 font-mono"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      checked={p.selected}
                      onChange={(e) =>
                        updateProduct(p.id, { selected: e.target.checked })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "orders" && (
          <table className="w-full text-sm border-t border-line">
            <thead>
              <tr className="text-left text-wire border-b border-line">
                <th className="py-2 pr-2">Product</th>
                <th className="py-2 pr-2">Total</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Tx hash</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-line align-top">
                  <td className="py-2 pr-2">{o.products?.title}</td>
                  <td className="py-2 pr-2 font-mono">${Number(o.total).toFixed(2)}</td>
                  <td className="py-2 pr-2">{o.status}</td>
                  <td className="py-2 pr-2 font-mono text-xs break-all max-w-[160px]">
                    {o.tx_hash || "—"}
                  </td>
                  <td className="py-2 pr-2 space-x-2">
                    {o.status === "failed" && (
                      <button
                        onClick={() => setOrderStatus(o.id, "refunded")}
                        className="underline"
                      >
                        Mark refunded
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
