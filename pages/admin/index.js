import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Admin() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("products");
  const [sortAvailableFirst, setSortAvailableFirst] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  // Wallet adjustment form
  const [adjEmail, setAdjEmail] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjMessage, setAdjMessage] = useState("");

  // DigiTrust reconciliation
  const [digitrustOrders, setDigitrustOrders] = useState(null);

  // Manual products
  const [manualProducts, setManualProducts] = useState([]);
  const [manualForm, setManualForm] = useState(emptyManualForm());
  const [manualMessage, setManualMessage] = useState("");

  function emptyManualForm() {
    return {
      id: null,
      title: "",
      description: "",
      sell_price: "",
      cost_price: "",
      available_stock: "",
      requires_email: false,
      delivery: "Within 1-6 hours",
      selected: true,
    };
  }

  async function loadManualProducts() {
    const res = await fetch("/api/admin/manual-products");
    const data = await res.json();
    if (data.success) setManualProducts(data.products);
  }

  async function saveManualProduct() {
    setManualMessage("");
    const body = {
      ...(manualForm.id !== null ? { id: manualForm.id } : {}),
      title: manualForm.title,
      description: manualForm.description,
      sell_price: Number(manualForm.sell_price),
      cost_price: Number(manualForm.cost_price || 0),
      available_stock: Number(manualForm.available_stock),
      requires_email: manualForm.requires_email,
      delivery: manualForm.delivery,
      selected: manualForm.selected,
    };
    const res = await fetch("/api/admin/manual-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      setManualMessage(manualForm.id !== null ? "Updated." : "Created.");
      setManualForm(emptyManualForm());
      loadManualProducts();
    } else {
      setManualMessage(`Failed: ${data.error}`);
    }
  }

  function editManualProduct(p) {
    setManualForm({
      id: p.id,
      title: p.title,
      description: p.description || "",
      sell_price: p.sell_price,
      cost_price: p.cost_price,
      available_stock: p.available_stock,
      requires_email: p.requires_email,
      delivery: p.delivery || "",
      selected: p.selected,
    });
  }

  async function archiveManualProduct(id) {
    if (!confirm("Archive this product? It will stop showing on the storefront (existing orders are kept).")) return;
    await fetch("/api/admin/manual-products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadManualProducts();
  }

  async function deliverManualOrder(orderId) {
    const items = prompt("Paste the delivered item(s)/instructions, one per line:");
    if (!items) return;
    const res = await fetch("/api/admin/manual-deliver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, items }),
    });
    const data = await res.json();
    if (!data.success) alert(`Failed: ${data.error}`);
    loadOrders();
  }

  // Debug tool state
  const [debugTx, setDebugTx] = useState("");
  const [debugResult, setDebugResult] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);

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
      loadDashboard();
      loadManualProducts();
    })();
  }, []);

  async function loadDashboard() {
    const res = await fetch("/api/admin/dashboard");
    const data = await res.json();
    if (data.success) setDashboard(data);
  }

  async function runManualSync() {
    setSyncing(true);
    setSyncMessage("");
    const res = await fetch("/api/admin/manual-sync", { method: "POST" });
    const data = await res.json();
    setSyncing(false);
    if (data.success) {
      setSyncMessage(`Synced ${data.synced} products.`);
      loadProducts();
      loadDashboard();
    } else {
      setSyncMessage(`Failed: ${data.error}`);
    }
  }

  async function submitAdjustment() {
    setAdjMessage("");
    const res = await fetch("/api/admin/wallet-adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adjEmail,
        amount: Number(adjAmount),
        reason: adjReason,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setAdjMessage(`Done — new balance $${Number(data.balance).toFixed(2)}.`);
      setAdjEmail("");
      setAdjAmount("");
      setAdjReason("");
    } else {
      setAdjMessage(`Failed: ${data.error}`);
    }
  }

  async function loadDigitrustOrders() {
    const res = await fetch("/api/admin/digitrust-orders");
    const data = await res.json();
    if (data.success) setDigitrustOrders(data.orders);
  }

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

  async function deleteOrder(id) {
    if (!confirm("Permanently delete this order? This can't be undone.")) return;
    await fetch("/api/admin/orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadOrders();
  }

  async function runDebug() {
    setDebugLoading(true);
    setDebugResult(null);
    const res = await fetch("/api/admin/debug-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tx_hash: debugTx }),
    });
    const data = await res.json();
    setDebugResult(data);
    setDebugLoading(false);
  }

  const visibleProducts = useMemo(() => {
    let list = sortAvailableFirst
      ? [...products].sort((a, b) => b.available_stock - a.available_stock)
      : products;
    const q = productSearch.trim().toLowerCase();
    if (q) list = list.filter((p) => p.title.toLowerCase().includes(q));
    return list;
  }, [products, sortAvailableFirst, productSearch]);

  const visibleOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        (o.products?.title || "").toLowerCase().includes(q) ||
        (o.tx_hash || "").toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
    );
  }, [orders, orderSearch]);

  const pendingManualCount = useMemo(
    () => orders.filter((o) => o.status === "awaiting_manual_fulfillment").length,
    [orders]
  );

  if (checking) return <p className="p-8 text-sm">Checking access…</p>;
  if (!allowed)
    return <p className="p-8 text-sm">This account doesn't have admin access.</p>;

  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      <header className="border-b border-line">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-display text-2xl">Admin</span>
          <nav className="text-sm space-x-4 sm:space-x-5">
            <button
              onClick={() => setTab("dashboard")}
              className={tab === "dashboard" ? "underline" : ""}
            >
              Dashboard
            </button>
            <button
              onClick={() => setTab("products")}
              className={tab === "products" ? "underline" : ""}
            >
              Products
            </button>
            <button
              onClick={() => setTab("manual")}
              className={tab === "manual" ? "underline" : ""}
            >
              Manual Products
            </button>
            <button
              onClick={() => setTab("orders")}
              className={tab === "orders" ? "underline" : ""}
            >
              Orders
              {pendingManualCount > 0 && (
                <span className="ml-1 text-signal">({pendingManualCount})</span>
              )}
            </button>
            <button
              onClick={() => setTab("debug")}
              className={tab === "debug" ? "underline" : ""}
            >
              Debug payment
            </button>
          </nav>
        </div>
        {dashboard && (
          <div
            className={`px-4 sm:px-6 py-2 text-xs font-mono flex flex-wrap gap-4 ${
              dashboard.digitrust.low ? "bg-signal/10 text-signal" : "bg-white text-wire"
            }`}
          >
            <span>
              DigiTrust balance:{" "}
              {dashboard.digitrust.error
                ? "unavailable"
                : `$${Number(dashboard.digitrust.balance).toFixed(2)}`}
              {dashboard.digitrust.low && " — LOW, top up soon"}
            </span>
            <span>
              Last sync:{" "}
              {dashboard.lastSync ? new Date(dashboard.lastSync).toLocaleString() : "never"}
            </span>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {tab === "dashboard" && (
          <div className="space-y-10 max-w-2xl">
            <div>
              <h2 className="font-display text-lg mb-3">Sync</h2>
              <button
                onClick={runManualSync}
                disabled={syncing}
                className="px-4 py-2 bg-ink text-paper text-sm disabled:opacity-40"
              >
                {syncing ? "Syncing…" : "Sync products now"}
              </button>
              {syncMessage && <p className="text-sm text-wire mt-2">{syncMessage}</p>}
            </div>

            {dashboard && (
              <div>
                <h2 className="font-display text-lg mb-3">Sales</h2>
                <dl className="text-sm grid grid-cols-2 gap-y-2 max-w-xs">
                  <dt className="text-wire">Orders delivered</dt>
                  <dd className="font-mono">{dashboard.sales.ordersDelivered}</dd>
                  <dt className="text-wire">Total sales</dt>
                  <dd className="font-mono">${dashboard.sales.totalSales.toFixed(2)}</dd>
                  <dt className="text-wire">Est. DigiTrust cost</dt>
                  <dd className="font-mono">${dashboard.sales.totalCost.toFixed(2)}</dd>
                  <dt className="text-wire">Est. profit</dt>
                  <dd className="font-mono">${dashboard.sales.profit.toFixed(2)}</dd>
                </dl>
                <p className="text-xs text-wire mt-2">
                  Cost is estimated from each product's current DigiTrust price, not
                  the historical price at time of sale.
                </p>
              </div>
            )}

            <div>
              <h2 className="font-display text-lg mb-3">Manual wallet credit / debit</h2>
              <div className="space-y-3 max-w-sm text-sm">
                <input
                  value={adjEmail}
                  onChange={(e) => setAdjEmail(e.target.value)}
                  placeholder="Customer email"
                  className="w-full border border-line px-3 py-2 bg-paper"
                />
                <input
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  type="number"
                  step="0.01"
                  placeholder="Amount (negative to debit)"
                  className="w-full border border-line px-3 py-2 bg-paper font-mono"
                />
                <input
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="Reason (required)"
                  className="w-full border border-line px-3 py-2 bg-paper"
                />
                <button
                  onClick={submitAdjustment}
                  disabled={!adjEmail || !adjAmount || !adjReason}
                  className="px-4 py-2 bg-ink text-paper text-sm disabled:opacity-40"
                >
                  Apply
                </button>
                {adjMessage && <p className="text-wire">{adjMessage}</p>}
              </div>
            </div>
          </div>
        )}

        {tab === "products" && (
          <>
            <div className="flex flex-wrap gap-3 justify-between mb-3">
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products…"
                className="border border-line px-3 py-1.5 bg-paper text-sm flex-1 min-w-[180px]"
              />
              <button
                onClick={() => setSortAvailableFirst((s) => !s)}
                className="text-sm px-3 py-1.5 border border-line hover:bg-white whitespace-nowrap"
              >
                {sortAvailableFirst ? "Sorted: in-stock first ✓" : "Sort: in-stock first"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-t border-line min-w-[640px]">
                <thead>
                  <tr className="text-left text-wire border-b border-line">
                    <th className="py-2 pr-2">Product</th>
                    <th className="py-2 pr-2">Real stock</th>
                    <th className="py-2 pr-2">Shown as</th>
                    <th className="py-2 pr-2">DigiTrust price</th>
                    <th className="py-2 pr-2">Your price</th>
                    <th className="py-2 pr-2">Show on site</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-b border-line ${
                        p.available_stock === 0 ? "opacity-50" : ""
                      }`}
                    >
                      <td className="py-2 pr-2">{p.title}</td>
                      <td className="py-2 pr-2 font-mono">{p.real_stock}</td>
                      <td className="py-2 pr-2 font-mono">{p.available_stock}</td>
                      <td className="py-2 pr-2 font-mono text-wire">
                        ${Number(p.cost_price).toFixed(2)}
                      </td>
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
            </div>
          </>
        )}

        {tab === "manual" && (
          <div className="space-y-8 max-w-2xl">
            <div>
              <h2 className="font-display text-lg mb-3">
                {manualForm.id !== null ? "Edit product" : "Add a manual product"}
              </h2>
              <div className="space-y-3 text-sm">
                <input
                  value={manualForm.title}
                  onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                  placeholder="Title"
                  className="w-full border border-line px-3 py-2 bg-paper"
                />
                <textarea
                  value={manualForm.description}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, description: e.target.value })
                  }
                  placeholder="Description (optional)"
                  className="w-full border border-line px-3 py-2 bg-paper"
                  rows={2}
                />
                <div className="flex gap-3">
                  <input
                    value={manualForm.sell_price}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, sell_price: e.target.value })
                    }
                    type="number"
                    step="0.01"
                    placeholder="Sell price"
                    className="flex-1 border border-line px-3 py-2 bg-paper font-mono"
                  />
                  <input
                    value={manualForm.cost_price}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, cost_price: e.target.value })
                    }
                    type="number"
                    step="0.01"
                    placeholder="Your cost (admin-only)"
                    className="flex-1 border border-line px-3 py-2 bg-paper font-mono"
                  />
                  <input
                    value={manualForm.available_stock}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, available_stock: e.target.value })
                    }
                    type="number"
                    step="1"
                    placeholder="Stock"
                    className="w-28 border border-line px-3 py-2 bg-paper font-mono"
                  />
                </div>
                <input
                  value={manualForm.delivery}
                  onChange={(e) => setManualForm({ ...manualForm, delivery: e.target.value })}
                  placeholder='Estimated delivery, e.g. "Within 1-6 hours"'
                  className="w-full border border-line px-3 py-2 bg-paper"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={manualForm.requires_email}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, requires_email: e.target.checked })
                    }
                  />
                  Requires customer email at checkout
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={manualForm.selected}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, selected: e.target.checked })
                    }
                  />
                  Active (shown on storefront)
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={saveManualProduct}
                    className="px-4 py-2 bg-ink text-paper text-sm"
                  >
                    {manualForm.id !== null ? "Save changes" : "Create product"}
                  </button>
                  {manualForm.id !== null && (
                    <button
                      onClick={() => setManualForm(emptyManualForm())}
                      className="px-4 py-2 border border-line text-sm"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
                {manualMessage && <p className="text-wire">{manualMessage}</p>}
              </div>
            </div>

            <div>
              <h2 className="font-display text-lg mb-3">Your manual products</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-t border-line min-w-[640px]">
                  <thead>
                    <tr className="text-left text-wire border-b border-line">
                      <th className="py-2 pr-2">Title</th>
                      <th className="py-2 pr-2">Stock</th>
                      <th className="py-2 pr-2">Sell price</th>
                      <th className="py-2 pr-2">Cost</th>
                      <th className="py-2 pr-2">Active</th>
                      <th className="py-2 pr-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualProducts.map((p) => (
                      <tr key={p.id} className="border-b border-line">
                        <td className="py-2 pr-2">{p.title}</td>
                        <td className="py-2 pr-2 font-mono">{p.available_stock}</td>
                        <td className="py-2 pr-2 font-mono">${Number(p.sell_price).toFixed(2)}</td>
                        <td className="py-2 pr-2 font-mono text-wire">
                          ${Number(p.cost_price).toFixed(2)}
                        </td>
                        <td className="py-2 pr-2">{p.selected ? "Yes" : "No"}</td>
                        <td className="py-2 pr-2 space-x-2 whitespace-nowrap">
                          <button onClick={() => editManualProduct(p)} className="underline">
                            Edit
                          </button>
                          {p.selected && (
                            <button
                              onClick={() => archiveManualProduct(p.id)}
                              className="underline text-signal"
                            >
                              Archive
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "orders" && (
          <>
            <input
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="Search by product, status, or tx hash…"
              className="border border-line px-3 py-1.5 bg-paper text-sm w-full mb-3"
            />
            {digitrustOrders && (
              <div className="mb-4 border border-line bg-white p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-display">DigiTrust's recent orders</span>
                  <button
                    onClick={() => setDigitrustOrders(null)}
                    className="text-xs underline text-wire"
                  >
                    Close
                  </button>
                </div>
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(digitrustOrders, null, 2)}
                </pre>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-t border-line min-w-[720px]">
                <thead>
                  <tr className="text-left text-wire border-b border-line">
                    <th className="py-2 pr-2">Product</th>
                    <th className="py-2 pr-2">Total</th>
                    <th className="py-2 pr-2">Paid with</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Tx hash</th>
                    <th className="py-2 pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((o) => (
                    <tr key={o.id} className="border-b border-line align-top">
                      <td className="py-2 pr-2">{o.products?.title}</td>
                      <td className="py-2 pr-2 font-mono">${Number(o.total).toFixed(2)}</td>
                      <td className="py-2 pr-2">{o.paid_with || "onchain"}</td>
                      <td className="py-2 pr-2">{o.status}</td>
                      <td className="py-2 pr-2 font-mono text-xs break-all max-w-[160px]">
                        {o.tx_hash || "—"}
                      </td>
                      <td className="py-2 pr-2 space-x-2 whitespace-nowrap">
                        {o.status === "pending_payment" && (
                          <button
                            onClick={() => setOrderStatus(o.id, "cancelled")}
                            className="underline"
                          >
                            Cancel
                          </button>
                        )}
                        {o.status === "awaiting_manual_fulfillment" && (
                          <button
                            onClick={() => deliverManualOrder(o.id)}
                            className="underline"
                          >
                            Deliver
                          </button>
                        )}
                        {o.status === "failed" && (
                          <button
                            onClick={() => setOrderStatus(o.id, "refunded")}
                            className="underline"
                          >
                            Mark refunded
                          </button>
                        )}
                        {o.status === "needs_reconciliation" && (
                          <>
                            <button
                              onClick={loadDigitrustOrders}
                              className="underline"
                            >
                              Check DigiTrust
                            </button>
                            <button
                              onClick={() => {
                                const items = prompt(
                                  "Paste delivered items, one per line (from DigiTrust's order history):"
                                );
                                if (items) {
                                  fetch("/api/admin/orders", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      id: o.id,
                                      status: "delivered",
                                      items,
                                    }),
                                  }).then(loadOrders);
                                }
                              }}
                              className="underline"
                            >
                              Mark delivered
                            </button>
                            <button
                              onClick={() => setOrderStatus(o.id, "failed")}
                              className="underline text-signal"
                            >
                              Mark failed
                            </button>
                          </>
                        )}
                        {["pending_payment", "payment_submitted", "failed", "cancelled"].includes(
                          o.status
                        ) && (
                          <button
                            onClick={() => deleteOrder(o.id)}
                            className="underline text-signal"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "debug" && (
          <div className="max-w-md space-y-4">
            <p className="text-sm text-wire">
              Paste any transaction hash to see exactly what the on-chain
              lookup returns — useful when payment verification isn't
              behaving as expected.
            </p>
            <input
              value={debugTx}
              onChange={(e) => setDebugTx(e.target.value)}
              placeholder="0x…"
              className="w-full border border-line px-3 py-2 bg-paper font-mono text-xs"
            />
            <button
              onClick={runDebug}
              disabled={!debugTx || debugLoading}
              className="px-4 py-2 bg-ink text-paper text-sm disabled:opacity-40"
            >
              {debugLoading ? "Checking…" : "Run lookup"}
            </button>
            {debugResult && (
              <pre className="bg-white border border-line p-3 text-xs whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(debugResult, null, 2)}
              </pre>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
