import { PrimaryButton } from "./Button";

// Storefront product card. Shows provider-neutral labels only —
// never exposes cost price or internal DigiTrust/manual plumbing to
// the customer.
export default function ProductCard({ product, onBuy, disabled }) {
  const isManual = product.provider === "manual";
  const lowStock = product.available_stock > 0 && product.available_stock <= 3;
  const outOfStock = product.available_stock <= 0;
  const letter = (product.title || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-sm font-semibold text-brand">
          {letter}
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
            isManual ? "bg-warning-soft text-warning" : "bg-success-soft text-success"
          }`}
        >
          {isManual ? "Manual delivery" : "Automatic delivery"}
        </span>
      </div>

      <h3 className="text-base font-semibold text-ink">{product.title}</h3>
      {product.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted">{product.description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        {outOfStock ? (
          <span className="font-medium text-danger">Out of stock</span>
        ) : (
          <span className={lowStock ? "font-medium text-warning" : ""}>
            {product.available_stock} available
          </span>
        )}
        {isManual && (
          <span className="before:mr-2 before:content-['·']">
            {product.delivery || "Delivery within 1–6 hours"}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 pt-2">
        <span className="text-lg font-semibold text-ink">
          ${Number(product.sell_price).toFixed(2)}
        </span>
        <PrimaryButton onClick={onBuy} disabled={disabled || outOfStock} className="px-4 py-2">
          {outOfStock ? "Out of stock" : "Buy now"}
        </PrimaryButton>
      </div>
    </div>
  );
}
