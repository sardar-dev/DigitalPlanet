import { useEffect, useRef } from "react";

// Accessible dialog: traps Escape to close, focuses itself on open,
// and marks itself up for assistive tech. Used by the Buy modal and
// the admin manual-delivery modal.
export default function Modal({ title, onClose, children, maxWidth = "max-w-md" }) {
  const panelRef = useRef(null);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`${maxWidth} max-h-[90vh] w-full overflow-y-auto rounded-xl bg-surface p-6 shadow-card-hover focus:outline-none`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-muted hover:bg-brand-soft hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
