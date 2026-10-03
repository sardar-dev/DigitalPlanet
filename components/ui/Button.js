// PrimaryButton / SecondaryButton — shared button styles so every
// page gets consistent hover/focus/active/disabled states instead of
// copy-pasted class strings drifting out of sync.
export function PrimaryButton({ className = "", children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-brand/90 active:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ className = "", children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-brand-soft active:bg-border disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function DangerButton({ className = "", children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({ className = "", children, ...props }) {
  return (
    <button
      type="button"
      className={`text-sm font-medium text-brand hover:text-brand/80 underline-offset-2 hover:underline disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
