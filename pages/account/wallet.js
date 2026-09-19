import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function Wallet() {
  const [balance, setBalance] = useState(null);
  const [payoutWallet, setPayoutWallet] = useState("");
  const [txHash, setTxHash] = useState("");
  const [status, setStatus] = useState("idle"); // idle | verifying | done | error
  const [message, setMessage] = useState("");

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
      setBalance(data.balance);
      setStatus("done");
      setTxHash("");
      setMessage(`Credited $${data.credited.toFixed(2)}.`);
    } else {
      setStatus("error");
      setMessage(describeError(data.error));
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      <header className="border-b border-line">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-baseline justify-between gap-2">
          <Link href="/" className="font-display text-2xl">
            Ledger Stock
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
            <p className="font-mono text-xs break-all bg-white border border-line p-3">
              {payoutWallet}
            </p>
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
