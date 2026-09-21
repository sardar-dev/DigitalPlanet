import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "../lib/supabaseClient";

// Used both in the checkout modal (fresh order) and on /account/orders
// (resuming a payment after a closed tab / refresh / lost connection).
// order needs: { id, total, payout_wallet }. Calls onDone(items) once
// the order is fulfilled.
export default function PaymentPanel({ order, onDone }) {
  const [method, setMethod] = useState(null); // 'wallet' | 'onchain' | null
  const [balance, setBalance] = useState(null);
  const [txHash, setTxHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", session.user.id)
        .single();
      setBalance(Number(data?.balance || 0));
    })();
    QRCode.toDataURL(order.payout_wallet, { margin: 1, width: 180 })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [order.payout_wallet]);

  const canPayWithBalance = balance !== null && balance >= Number(order.total);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(order.payout_wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — silently ignore, address is
      // still visible/selectable as text.
    }
  }

  async function payWithBalance() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/orders/pay-with-balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.success) {
      onDone({ items: data.items, manual: data.manual });
    } else {
      setError(describeError(data.error));
    }
  }

  async function submitPayment() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/orders/verify-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id, tx_hash: txHash }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.success) {
      onDone({ items: data.items, manual: data.manual });
    } else {
      setError(describeError(data.error));
    }
  }

  if (!method) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Choose how to pay:</p>
        {canPayWithBalance && (
          <button
            onClick={() => setMethod("wallet")}
            className="w-full py-2 border border-line hover:bg-white text-sm text-left px-3"
          >
            Pay with wallet balance{" "}
            <span className="font-mono">(${balance.toFixed(2)} available)</span>
          </button>
        )}
        <button
          onClick={() => setMethod("onchain")}
          className="w-full py-2 border border-line hover:bg-white text-sm text-left px-3"
        >
          Deposit USDT (BEP20)
        </button>
      </div>
    );
  }

  if (method === "wallet") {
    return (
      <div className="space-y-3 text-sm">
        <p>
          Pay <span className="font-mono">${Number(order.total).toFixed(2)}</span> with your
          wallet balance?
        </p>
        {error && <p className="text-signal">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => setMethod(null)}
            className="flex-1 py-2 border border-line text-sm"
          >
            Back
          </button>
          <button
            onClick={payWithBalance}
            disabled={busy}
            className="flex-1 py-2 bg-ink text-paper hover:bg-wire transition-colors disabled:opacity-40"
          >
            {busy ? "Processing…" : "Confirm"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <button onClick={() => setMethod(null)} className="text-xs underline text-wire">
        ← Back
      </button>
      <p>
        Send exactly{" "}
        <span className="font-mono text-base">${Number(order.total).toFixed(4)}</span> USDT on
        the <strong>BEP20 (BNB Smart Chain)</strong> network to:
      </p>
      <div className="flex items-start gap-3">
        {qrDataUrl && (
          <img src={qrDataUrl} alt="Wallet address QR code" className="w-24 h-24 flex-shrink-0" />
        )}
        <div className="flex-1 space-y-2">
          <p className="font-mono text-xs break-all bg-white border border-line p-3">
            {order.payout_wallet}
          </p>
          <button onClick={copyAddress} className="text-xs underline">
            {copied ? "Copied!" : "Copy address"}
          </button>
        </div>
      </div>
      <p className="text-wire">
        Sending on any other network will lose the funds — double-check BEP20 before sending.
      </p>
      <label className="block">
        Transaction hash
        <input
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          placeholder="0x…"
          className="w-full mt-1 border border-line px-3 py-2 bg-paper font-mono text-xs"
        />
      </label>
      {error && <p className="text-signal">{error}</p>}
      <button
        onClick={submitPayment}
        disabled={!txHash || busy}
        className="w-full py-2 bg-ink text-paper hover:bg-wire transition-colors disabled:opacity-40"
      >
        {busy ? "Checking…" : "I've sent it — verify payment"}
      </button>
    </div>
  );
}

function describeError(code) {
  switch (code) {
    case "not_found_yet":
      return "That transaction isn't visible on-chain yet — wait a bit and try again.";
    case "chain_lookup_failed":
      return "Couldn't reach the blockchain right now — try again in a moment.";
    case "tx_failed":
      return "That transaction failed on-chain — it never went through.";
    case "wrong_recipient":
      return "That transaction wasn't a USDT (BEP20) transfer to our wallet.";
    case "amount_too_low":
      return "The amount received doesn't match the order total.";
    case "awaiting_confirmations":
      return "Payment seen, waiting for more confirmations — try again shortly.";
    case "tx_already_used":
      return "That transaction hash was already used on another order.";
    case "insufficient_balance":
      return "Not enough wallet balance for this order.";
    case "out_of_stock_refund_pending":
      return "Sold out at the last moment — your payment will be refunded manually, sorry.";
    case "fulfillment_uncertain_pending_review":
      return "Payment received — we're double-checking delivery, this may take a few minutes.";
    default:
      return code ? code.replaceAll("_", " ") : "Something went wrong.";
  }
}
