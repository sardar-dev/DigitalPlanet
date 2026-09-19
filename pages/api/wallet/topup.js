import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { verifyUsdtTopup } from "../../../lib/bscscan";
import { claimTxHash, confirmTxHash, releaseTxHash } from "../../../lib/claimTxHash";

// Customer sends USDT to our wallet whenever they like (not tied to
// a specific order) and submits the tx hash here. Once verified
// on-chain, the amount is added to their store-credit balance.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "method_not_allowed" });
  }

  const supabaseServer = createPagesServerClient({ req, res });
  const {
    data: { session },
  } = await supabaseServer.auth.getSession();

  if (!session) {
    return res.status(401).json({ success: false, error: "login_required" });
  }

  const { tx_hash: rawTxHash } = req.body || {};
  if (!rawTxHash) {
    return res.status(400).json({ success: false, error: "tx_hash_required" });
  }
  const tx_hash = rawTxHash.toLowerCase();

  // Atomic claim — the same hash can't be credited twice, reused on
  // an order, or raced by a double-click, no matter its letter case.
  const claim = await claimTxHash(tx_hash, "topup", null);
  if (!claim.claimed) {
    return res.status(409).json({ success: false, error: "tx_already_used" });
  }

  const verdict = await verifyUsdtTopup({ txHash: tx_hash });
  if (!verdict.ok) {
    await releaseTxHash(tx_hash);
    return res.status(202).json({ success: false, error: verdict.reason });
  }

  await confirmTxHash(tx_hash);

  const { error: insertErr } = await supabaseAdmin.from("wallet_topups").insert({
    user_id: session.user.id,
    tx_hash,
    amount: verdict.amount,
    status: "credited",
  });
  if (insertErr && insertErr.code !== "23505") {
    return res.status(500).json({ success: false, error: insertErr.message });
  }

  // Atomic, single-statement balance credit.
  const { data: newBalance, error: balErr } = await supabaseAdmin.rpc(
    "increment_balance",
    { p_user_id: session.user.id, p_amount: verdict.amount }
  );
  if (balErr) {
    return res.status(500).json({ success: false, error: balErr.message });
  }

  return res.status(200).json({ success: true, credited: verdict.amount, balance: newBalance });
}
