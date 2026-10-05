import { useState } from "react";
import { SecondaryButton, LinkButton } from "../ui/Button";

// Shown above a product table once at least one row is checked.
// Deliberately narrow actions only (show/hide, +/-% price) — no bulk
// delete, no bulk absolute price — so a slip here can't do
// unrecoverable damage across many products at once.
export default function BulkActionBar({ count, onShow, onHide, onAdjustPercent, onClear }) {
  const [percent, setPercent] = useState("");

  if (count === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-brand/30 bg-brand-soft px-4 py-2.5 text-sm">
      <span className="font-medium text-ink">{count} selected</span>
      <SecondaryButton onClick={onShow} className="px-3 py-1.5 text-xs">
        Show on site
      </SecondaryButton>
      <SecondaryButton onClick={onHide} className="px-3 py-1.5 text-xs">
        Hide from site
      </SecondaryButton>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          step="1"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          placeholder="±%"
          className="w-16 rounded-md border border-border px-2 py-1 font-mono text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          aria-label="Price adjustment percent"
        />
        <SecondaryButton
          onClick={() => percent && onAdjustPercent(Number(percent))}
          disabled={!percent}
          className="px-3 py-1.5 text-xs"
        >
          Adjust price %
        </SecondaryButton>
      </div>
      <LinkButton onClick={onClear} className="text-xs">
        Clear selection
      </LinkButton>
    </div>
  );
}
