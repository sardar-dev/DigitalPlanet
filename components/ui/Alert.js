// Inline success/error/info banners used across forms (auth pages,
// checkout, admin forms) instead of bare colored <p> tags.
const VARIANTS = {
  error: "bg-danger-soft text-danger border border-danger/20",
  success: "bg-success-soft text-success border border-success/20",
  info: "bg-brand-soft text-brand border border-brand/20",
  warning: "bg-warning-soft text-warning border border-warning/20",
};

export default function Alert({ variant = "info", children }) {
  if (!children) return null;
  return (
    <div
      className={`rounded-lg px-3.5 py-2.5 text-sm ${VARIANTS[variant] || VARIANTS.info}`}
      role={variant === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {children}
    </div>
  );
}
