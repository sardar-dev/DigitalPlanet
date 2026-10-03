import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import SEO from "../../components/SEO";
import SiteHeader from "../../components/layout/SiteHeader";
import SiteFooter from "../../components/layout/SiteFooter";
import PageContainer from "../../components/layout/PageContainer";
import Alert from "../../components/ui/Alert";
import { FormInput } from "../../components/ui/FormInput";
import { PrimaryButton, SecondaryButton } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/States";

export default function Wallet() {
  const [session, setSession] = useState(null);
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
    setSession(session);
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
            <p className="mt-1 text-sm text-muted">
              Send any amount of USDT on the{" "}
              <span className="font-medium text-ink">BEP20 (BNB Smart Chain)</span> network, then
              paste the transaction hash below — it's added to your balance once confirmed
              on-chain.
            </p>

            {payoutWallet && (
              <div className="mt-4 flex items-start gap-3">
                <p className="flex-1 break-all rounded-lg border border-border bg-brand-soft p-3 font-mono text-xs text-ink">
                  {payoutWallet}
                </p>
                <SecondaryButton onClick={copyAddress} className="px-3 py-1.5 text-xs">
                  {copied ? "Copied!" : "Copy address"}
                </SecondaryButton>
              </div>
            )}

            <div className="mt-4 space-y-3 max-w-md">
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
                {status === "verifying" ? "Checking…" : "Verify & credit"}
              </PrimaryButton>
            </div>
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
      return code ? code.replaceAll("_", " ") : "";
  }
}
