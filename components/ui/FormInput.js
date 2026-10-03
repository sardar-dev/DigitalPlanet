// Shared form field wrapper: label, input, helper text and error
// message, all using the Cloud Commerce tokens. Keeping this in one
// place is what makes every form on the site look consistent.
export function FormInput({ label, hint, error, className = "", id, ...props }) {
  const inputId = id || props.name;
  return (
    <label className="block text-sm" htmlFor={inputId}>
      {label && <span className="mb-1.5 block font-medium text-ink">{label}</span>}
      <input
        id={inputId}
        className={`w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/30 ${
          error ? "border-danger" : "border-border focus:border-brand"
        } ${className}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {hint && !error && (
        <span id={`${inputId}-hint`} className="mt-1.5 block text-xs text-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${inputId}-error`} className="mt-1.5 block text-xs text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

export function FormTextarea({ label, hint, error, className = "", id, ...props }) {
  const inputId = id || props.name;
  return (
    <label className="block text-sm" htmlFor={inputId}>
      {label && <span className="mb-1.5 block font-medium text-ink">{label}</span>}
      <textarea
        id={inputId}
        className={`w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/30 ${
          error ? "border-danger" : "border-border focus:border-brand"
        } ${className}`}
        aria-invalid={error ? "true" : undefined}
        {...props}
      />
      {hint && !error && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export function FormSelect({ label, hint, className = "", id, children, ...props }) {
  const inputId = id || props.name;
  return (
    <label className="block text-sm" htmlFor={inputId}>
      {label && <span className="mb-1.5 block font-medium text-ink">{label}</span>}
      <select
        id={inputId}
        className={`w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 ${className}`}
        {...props}
      >
        {children}
      </select>
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
