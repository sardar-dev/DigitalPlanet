import { useEffect, useState } from "react";
import StatCard from "./StatCard";
import DataTable from "./DataTable";
import SectionHeading from "../ui/SectionHeading";
import { SecondaryButton } from "../ui/Button";
import { ErrorState, LoadingState } from "../ui/States";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

// Loads only when this tab is opened (and on Refresh) — never polls.
export default function StatsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "failed");
      setStats(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading && !stats) return <LoadingState label="Loading statistics…" />;
  if (error && !stats)
    return <ErrorState title="Couldn't load statistics" onRetry={load} />;
  if (!stats) return null;

  const { users, orders, revenue, products, wallet } = stats;
  const statusRows = Object.entries(orders.byStatus).sort((a, b) => b[1] - a[1]);
  const maxDaily = Math.max(1, ...orders.daily.map((d) => d.orders));

  return (
    <div className="space-y-10">
      <SectionHeading
        title="Statistics"
        description={`Live from the database · updated ${new Date(
          stats.generatedAt
        ).toLocaleTimeString()}`}
        action={
          <SecondaryButton onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </SecondaryButton>
        }
      />
      {stats.truncated && (
        <p className="text-xs text-warning">
          Order stats are based on the most recent 10,000 orders only.
        </p>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Users</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total users" value={users.total} />
          <StatCard label="New (7 days)" value={users.last7} />
          <StatCard label="New (30 days)" value={users.last30} />
          <StatCard
            label="Customers who bought"
            value={users.buyers}
            hint={
              users.total
                ? `${((users.buyers / users.total) * 100).toFixed(1)}% of users`
                : undefined
            }
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Orders &amp; revenue</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total orders" value={orders.total} />
          <StatCard label="Delivered" value={orders.delivered} />
          <StatCard label="Orders (7 days)" value={orders.last7} />
          <StatCard label="Orders (30 days)" value={orders.last30} />
          <StatCard label="Revenue (all time)" value={money(revenue.total)} />
          <StatCard label="Revenue (7 days)" value={money(revenue.last7)} />
          <StatCard label="Revenue (30 days)" value={money(revenue.last30)} />
          <StatCard label="Avg order value" value={money(orders.avgOrderValue)} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Orders by status</h3>
          <DataTable minWidth="min-w-0">
            <tbody className="divide-y divide-border">
              {statusRows.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-muted">No orders yet.</td>
                </tr>
              )}
              {statusRows.map(([s, n]) => (
                <tr key={s}>
                  <td className="px-4 py-2.5 text-ink">{s.replaceAll("_", " ")}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{n}</td>
                </tr>
              ))}
              <tr>
                <td className="px-4 py-2.5 text-muted">Paid via on-chain USDT</td>
                <td className="px-4 py-2.5 text-right font-mono">{orders.byMethod.onchain || 0}</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-muted">Paid via wallet balance</td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {orders.byMethod.wallet_balance || 0}
                </td>
              </tr>
            </tbody>
          </DataTable>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Last 14 days</h3>
          <div className="space-y-1.5 rounded-xl border border-border bg-surface p-4 shadow-card">
            {orders.daily.length === 0 && <p className="text-sm text-muted">No recent orders.</p>}
            {orders.daily.map((d) => (
              <div key={d.date} className="flex items-center gap-3 text-xs">
                <span className="w-20 font-mono text-muted">{d.date.slice(5)}</span>
                <div className="h-2 flex-1 rounded-full bg-brand-soft">
                  <div
                    className="h-2 rounded-full bg-brand"
                    style={{ width: `${(d.orders / maxDaily) * 100}%` }}
                  />
                </div>
                <span className="w-24 text-right font-mono text-ink">
                  {d.orders} · {money(d.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Products</h3>
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total products" value={products.total} />
          <StatCard label="Live on store" value={products.live} />
          <StatCard label="Manual products" value={products.manual} />
          <StatCard label="DigiTrust products" value={products.total - products.manual} />
        </div>
        <DataTable>
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5">Best sellers</th>
              <th className="px-4 py-2.5 text-right">Units</th>
              <th className="px-4 py-2.5 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.top.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-muted">
                  No delivered orders yet.
                </td>
              </tr>
            )}
            {products.top.map((p) => (
              <tr key={p.title}>
                <td className="px-4 py-2.5 text-ink">{p.title}</td>
                <td className="px-4 py-2.5 text-right font-mono">{p.units}</td>
                <td className="px-4 py-2.5 text-right font-mono">{money(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Wallet</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard label="Top-ups credited" value={wallet.topups} />
          <StatCard label="Top-up volume" value={money(wallet.topupTotal)} />
          <StatCard label="Balances held" value={money(wallet.heldBalance)} hint="owed to users" />
          <StatCard label="Pending invoices" value={wallet.pendingInvoices} />
          <StatCard label="Manual adjustments" value={wallet.adjustments} />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Newest users</h3>
        <DataTable>
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5 text-right">Balance</th>
              <th className="px-4 py-2.5 text-right">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.recent.map((u) => (
              <tr key={u.email + u.created_at}>
                <td className="px-4 py-2.5 text-ink">{u.email}</td>
                <td className="px-4 py-2.5 text-right font-mono">{money(u.balance)}</td>
                <td className="px-4 py-2.5 text-right text-muted">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
    </div>
  );
}
