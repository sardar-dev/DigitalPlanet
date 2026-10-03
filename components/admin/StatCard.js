export default function StatCard({ label, value, hint, tone = "default" }) {
  const toneCls =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
      ? "text-warning"
      : "text-ink";
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}
