import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "../../lib/supabaseClient";
import SEO from "../../components/SEO";
import SiteHeader from "../../components/layout/SiteHeader";
import SiteFooter from "../../components/layout/SiteFooter";
import PageContainer from "../../components/layout/PageContainer";
import Alert from "../../components/ui/Alert";
import { FormInput } from "../../components/ui/FormInput";
import { PrimaryButton, SecondaryButton, LinkButton } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/States";

export default function Wallet() {
  const [session, setSession] = useState(null);
  const [balance, setBalance] = useState(null);
  const [ledger, setLedger] = useState([]);

  // Deposit flow: request-amount -> invoice -> pay -> submit tx hash
  const [requestAmount, setRequestAmount] = useState("");
  const [invoice, setInvoice] = useState(null); // { id, amount, expires_at, payout_wallet }
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [txHash, setTxHash] = useState("");
  const [status, setStatus] = useState("idle"); // idle | requesting | verifying | done | error
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!invoice) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(invoice.expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [invoice]);

  async function load() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = "/login";
      return;
    }
    setSession(session);
    const { data } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", session.user.id)
      .single();
    setBalance(Number(data?.balance || 0));

    const [{ data: topups }, { data: adjustments }, { data: spentOrders }] = await Promise.all([
      supabase
        .from("wallet_topups")
        .select("id, amount, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("wallet_adjustments")
        .select("id, amount, reason, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("id, total, created_at, products(title)")
        .eq("paid_with", "wallet_balance")
        .order("created_at", { ascending: false }),
    ]);

    const entries = [
      ...(topups || []).map((t) => ({
        id: `topup-${t.id}`,
        date: t.created_at,
        label: "Top-up credit",
        amount: Number(t.amount),
      })),
      ...(adjustments || []).map((a) => ({
        id: `adj-${a.id}`,
        date: a.created_at,
        label: `Admin adjustment — ${a.reason}`,
        amount: Number(a.amount),
      })),
      ...(spentOrders || []).map((o) => ({
        id: `order-${o.id}`,
        date: o.created_at,
        label: `Purchase — ${o.products?.title || "product"}`,
        amount: -Number(o.total),
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    setLedger(entries);
  }

  async function requestInvoice() {
    setStatus("requesting");
    setMessage("");
    const res = await fetch("/api/wallet/create-deposit-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(requestAmount) }),
    });
    const data = await res.json();
    setStatus("idle");
    if (!data.success) {
      setMessage(describeInvoiceError(data.error));
      return;
    }
    setInvoice({ ...data.invoice, payout_wallet: data.payout_wallet });
    QRCode.toDataURL(data.payout_wallet, { margin: 1, width: 180 })
      .then(setQrDataUrl)
      .catch(() => {});
  }

  function cancelInvoice() {
    setInvoice(null);
    setQrDataUrl("");
    setTxHash("");
    setMessage("");
    setStatus("idle");
  }

  async function copyAmount() {
    try {
      await navigator.clipboard.writeText(String(invoice.amount));
      setCopied("amount");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — amount is still visible as text.
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(invoice.payout_wallet);
      setCopied("address");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — address is still visible as text.
    }
  }

  async function submitTopup() {
    setStatus("verifying");
    setMessage("");
    const res = await fetch("/api/wallet/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tx_hash: txHash, invoice_id: invoice.id }),
    });
    const data = await res.json();
    if (data.success) {
      setStatus("done");
      setMessage(`Credited $${data.credited.toFixed(2)}.`);
      setTxHash("");
      setInvoice(null);
      setQrDataUrl("");
      load();
    } else {
      setStatus("error");
      setMessage(describeError(data.error, data));
    }
  }

  const expired = secondsLeft === 0;

  return (
    <div className="flex min-h-screen flex-col bg-bg font-body text-ink">
      <SEO title="Wallet" path="/account/wallet" noindex />
      <SiteHeader session={session} balance={balance} onSignOut={() => supabase.auth.signOut()} />

      <main className="flex-1">
        <PageContainer className="space-y-8 py-10" width="max-w-3xl">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
            <div className="text-sm text-muted">Wallet balance</div>
            <div className="mt-1 text-3xl font-semibold text-ink">
              {balance === null ? "…" : `$${balance.toFixed(2)}`}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold text-ink">Top up</h2>

            {!invoice && (
              <>
                <p className="mt-1 text-sm text-muted">
                  Choose how much you'd like to add. We'll give you an exact amount to send — this
                  keeps your deposit safely matched to you and only you.
                </p>
                <div className="mt-4 max-w-sm space-y-3">
                  <FormInput
                    label="Amount to add (USD)"
                    type="number"
                    min="1"
                    step="1"
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    placeholder="e.g. 10"
                  />
                  <Alert variant="error">{status !== "requesting" ? message : ""}</Alert>
                  <PrimaryButton
                    onClick={requestInvoice}
                    disabled={!requestAmount || Number(requestAmount) <= 0 || status === "requesting"}
                    className="w-full"
                  >
                    {status === "requesting" ? "Generating…" : "Get deposit amount"}
                  </PrimaryButton>
                </div>
              </>
            )}

            {invoice && (
              <div className="mt-4 space-y-4">
                <Alert variant="warning">
                  Send only USDT on <strong>BEP20 (BNB Smart Chain)</strong>. Other tokens or
                  networks will be lost.
                </Alert>

                <div className="rounded-lg border border-border bg-brand-soft p-4">
                  <div className="text-xs text-muted">Send exactly</div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-2xl font-semibold text-ink">
                      ${invoice.amount.toFixed(4)}
                    </span>
                    <SecondaryButton onClick={copyAmount} className="px-3 py-1.5 text-xs">
                      {copied === "amount" ? "Copied!" : "Copy amount"}
                    </SecondaryButton>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Sending any other amount won't be matched automatically — it must be exact.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="QR code for the payout wallet address"
                      className="h-24 w-24 flex-shrink-0 rounded-lg border border-border"
                    />
                  )}
                  <div className="flex-1 space-y-2">
                    <p className="break-all rounded-lg border border-border bg-surface p-3 font-mono text-xs text-ink">
                      {invoice.payout_wallet}
                    </p>
                    <SecondaryButton onClick={copyAddress} className="px-3 py-1.5 text-xs">
                      {copied === "address" ? "Copied!" : "Copy address"}
                    </SecondaryButton>
                  </div>
                </div>

                <p className="text-xs text-muted">
                  {expired ? (
                    <span className="font-medium text-danger">
                      This deposit amount has expired — request a new one below.
                    </span>
                  ) : (
                    <>Expires in {formatCountdown(secondsLeft)}.</>
                  )}
                </p>

                {!expired && (
                  <div className="space-y-3 max-w-md">
                    <FormInput
                      label="Transaction hash"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      placeholder="0x…"
                      className="font-mono text-xs"
                    />
                    <Alert variant={status === "error" ? "error" : "success"}>{message}</Alert>
                    <PrimaryButton
                      onClick={submitTopup}
                      disabled={!txHash || status === "verifying"}
                      className="w-full"
                    >
                      {status === "verifying" ? "Checking…" : "I've sent it — verify payment"}
                    </PrimaryButton>
                  </div>
                )}

                <LinkButton onClick={cancelInvoice} className="text-xs">
                  {expired ? "Request a new amount" : "Cancel and start over"}
                </LinkButton>
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-ink">History</h2>
            {ledger.length === 0 && <EmptyState title="Nothing yet" />}
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface shadow-card">
              {ledger.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <div className="text-ink">{entry.label}</div>
                    <div className="text-xs text-muted">
                      {new Date(entry.date).toLocaleString()}
                    </div>
                  </div>
                  <span
                    className={`font-mono font-medium ${
                      entry.amount < 0 ? "text-danger" : "text-success"
                    }`}
                  >
                    {entry.amount >= 0 ? "+" : ""}
                    {entry.amount.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </PageContainer>
      </main>

      <SiteFooter />
    </div>
  );
}

function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function describeInvoiceError(code) {
  switch (code) {
    case "invalid_amount":
      return "Enter a valid amount greater than $0.";
    case "could_not_allocate_amount":
      return "Couldn't generate a unique amount right now — please try again.";
    default:
      return code ? code.replaceAll("_", " ") : "Something went wrong.";
  }
}

function describeError(code, data) {
  switch (code) {
    case "not_found_yet":
      return "That transaction isn't visible on-chain yet — wait a bit and try again.";
    case "chain_lookup_failed":
      return "Couldn't reach the blockchain right now — try again in a moment.";
    case "tx_failed":
      return "That transaction failed on-chain — it never went through.";
    case "wrong_recipient":
      return "That transaction wasn't a USDT (BEP20) transfer to our wallet.";
    case "awaiting_confirmations":
      return "Payment seen, waiting for more confirmations — try again shortly.";
    case "tx_already_used":
      return "That transaction hash was already used.";
    case "amount_mismatch":
      return data?.received !== undefined
        ? `That transaction sent $${Number(data.received).toFixed(4)}, but this invoice needs exactly $${Number(data.expected).toFixed(4)}.`
        : "That transaction's amount doesn't match this deposit invoice.";
    case "invoice_not_found":
      return "That deposit request wasn't found — please request a new amount.";
    case "invoice_not_pending":
      return "That deposit request was already used — please request a new amount.";
    case "invoice_expired":
      return "That deposit amount expired — please request a new one.";
    default:
      return code ? code.replaceAll("_", " ") : "";
  }
}
