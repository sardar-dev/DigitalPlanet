import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import SEO from "../../components/SEO";
import { SITE_NAME } from "../../lib/siteConfig";

export default function Wallet() {
  const [balance, setBalance] = useState(null);
  const [payoutWallet, setPayoutWallet] = useState("");
  const [txHash, setTxHash] = useState("");
  const [status, setStatus] = useState("idle"); // idle | verifying | done | error
  const [message, setMessage] = useState("");
  const [ledger, setLedger] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = "/login";
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", session.user.id)
      .single();
    setBalance(Number(data?.balance || 0));

    const walletRes = await fetch("/api/payout-wallet");
    const walletData = await walletRes.json();
    setPayoutWallet(walletData.address || "");

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
        label: "Top-up",
        amount: Number(t.amount),
      })),
      ...(adjustments || []).map((a) => ({
        id: `adj-${a.id}`,
        date: a.created_at,
        label: `Adjustment — ${a.reason}`,
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

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(payoutWallet);
      setCopied(true);
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
      body: JSON.stringify({ tx_hash: txHash }),
    });
    const data = await res.json();
    if (data.success) {
      setStatus("done");
      setTxHash("");
      setMessage(`Credited $${data.credited.toFixed(2)}.`);
      load();
    } else {
      setStatus("error");
      setMessage(describeError(data.error));
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      <SEO title="Wallet" path="/account/wallet" noindex />
      <header className="border-b border-line">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-baseline justify-between gap-2">
          <Link href="/" className="font-display text-2xl">
            {SITE_NAME}
          </Link>
          <nav className="text-sm space-x-5">
            <Link href="/account/orders" className="hover:underline">
              My orders
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div>
          <div className="text-sm text-wire">Wallet balance</div>
          <div className="font-display text-3xl">
            {balance === null ? "…" : `$${balance.toFixed(2)}`}
          </div>
        </div>

        <div className="space-y-4 max-w-md">
          <h2 className="font-display text-lg">Top up</h2>
          <p className="text-sm text-wire">
            Send any amount of USDT on the <strong>BEP20 (BNB Smart Chain)</strong> network,
            then paste the transaction hash below — it's added to your balance
            once confirmed on-chain.
          </p>
          {payoutWallet && (
            <div className="space-y-2">
              <p className="font-mono text-xs break-all bg-white border border-line p-3">
                {payoutWallet}
              </p>
              <button onClick={copyAddress} className="text-xs underline">
                {copied ? "Copied!" : "Copy address"}
              </button>
            </div>
          )}
          <label className="block text-sm">
            Transaction hash
            <input
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x…"
              className="w-full mt-1 border border-line px-3 py-2 bg-paper font-mono text-xs"
            />
          </label>
          {message && (
            <p className={status === "error" ? "text-sm text-signal" : "text-sm text-wire"}>
              {message}
            </p>
          )}
          <button
            onClick={submitTopup}
            disabled={!txHash || status === "verifying"}
            className="w-full py-2 bg-ink text-paper hover:bg-wire transition-colors disabled:opacity-40"
          >
            {status === "verifying" ? "Checking…" : "Verify & credit"}
          </button>
        </div>

        <div>
          <h2 className="font-display text-lg mb-3">History</h2>
          {ledger.length === 0 && (
            <p className="text-sm text-wire">Nothing yet.</p>
          )}
          <ul className="divide-y divide-line border-t border-b border-line text-sm">
            {ledger.map((entry) => (
              <li key={entry.id} className="py-3 flex justify-between gap-3">
                <div>
                  <div>{entry.label}</div>
                  <div className="text-xs text-wire">
                    {new Date(entry.date).toLocaleString()}
                  </div>
                </div>
                <span className={`font-mono ${entry.amount < 0 ? "text-signal" : ""}`}>
                  {entry.amount >= 0 ? "+" : ""}
                  {entry.amount.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>
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
    case "awaiting_confirmations":
      return "Payment seen, waiting for more confirmations — try again shortly.";
    case "tx_already_used":
      return "That transaction hash was already used.";
    default:
      return code ? code.replaceAll("_", " ") : "Something went wrong.";
  }
}
