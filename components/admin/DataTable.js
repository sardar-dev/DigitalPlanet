// Thin wrapper that gives every admin table the same scroll/border
// treatment on small screens, without dictating column content.
export default function DataTable({ children, minWidth = "min-w-[640px]" }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-card">
      <table className={`w-full text-sm ${minWidth}`}>{children}</table>
    </div>
  );
}
