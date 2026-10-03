import { FormInput } from "../ui/FormInput";
import { PrimaryButton } from "../ui/Button";

export default function DebugTab({ debugTx, setDebugTx, runDebug, debugLoading, debugResult }) {
  return (
    <div className="max-w-md space-y-4">
      <p className="text-sm text-muted">
        Paste any transaction hash to see exactly what the on-chain lookup returns — useful when
        payment verification isn't behaving as expected.
      </p>
      <FormInput
        value={debugTx}
        onChange={(e) => setDebugTx(e.target.value)}
        placeholder="0x…"
        className="font-mono text-xs"
      />
      <PrimaryButton onClick={runDebug} disabled={!debugTx || debugLoading}>
        {debugLoading ? "Checking…" : "Run lookup"}
      </PrimaryButton>
      {debugResult && (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-xs text-ink shadow-card">
          {JSON.stringify(debugResult, null, 2)}
        </pre>
      )}
    </div>
  );
}
