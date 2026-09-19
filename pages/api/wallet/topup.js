import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { verifyUsdtTopup } from "../../../lib/bscscan";

// Customer sends USDT to our wallet whenever they like (not tied to
// a specific order) and submits the tx hash here. Once verified
// on-chain, the amount is added to their store-credit balance so
// future checkouts can be instant (see /api/orders/pay-with-balance).
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

  const { tx_hash } = req.body || {};
  if (!tx_hash) {
    return res.status(400).json({ success: false, error: "tx_hash_required" });
  }

  // A tx hash can only ever be credited once — check both tables.
  const { data: usedInOrder } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("tx_hash", tx_hash)
    .maybeSingle();
  const { data: usedInTopup } = await supabaseAdmin
    .from("wallet_topups")
    .select("id")
    .eq("tx_hash", tx_hash)
    .maybeSingle();

  if (usedInOrder || usedInTopup) {
    return res.status(409).json({ success: false, error: "tx_already_used" });
  }

  const verdict = await verifyUsdtTopup({ txHash: tx_hash });
  if (!verdict.ok) {
    return res.status(202).json({ success: false, error: verdict.reason });
  }

  // Insert first — the unique constraint on tx_hash means a second,
  // near-simultaneous request with the same hash fails here instead
  // of double-crediting the balance.
  const { error: insertErr } = await supabaseAdmin.from("wallet_topups").insert({
    user_id: session.user.id,
    tx_hash,
    amount: verdict.amount,
    status: "credited",
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      // unique_violation — someone else's concurrent request won the race
      return res.status(409).json({ success: false, error: "tx_already_used" });
    }
    return res.status(500).json({ success: false, error: insertErr.message });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("balance")
    .eq("id", session.user.id)
    .single();

  const newBalance = Number(profile?.balance || 0) + verdict.amount;

  await supabaseAdmin
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", session.user.id);

  return res.status(200).json({ success: true, credited: verdict.amount, balance: newBalance });
}
