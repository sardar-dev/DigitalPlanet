import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { verifyUsdtPayment } from "../../../lib/bscscan";
import { fulfillOrder } from "../../../lib/fulfillOrder";

// Step 2 of checkout: customer submits the tx hash of their USDT
// (BEP20) transfer. We verify it on-chain, and if it checks out we
// immediately buy from DigiTrust and store the delivered items —
// no manual approval needed.
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

  const { order_id, tx_hash } = req.body || {};
  if (!order_id || !tx_hash) {
    return res.status(400).json({ success: false, error: "invalid_request" });
  }

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", order_id)
    .eq("user_id", session.user.id)
    .single();

  if (orderErr || !order) {
    return res.status(404).json({ success: false, error: "order_not_found" });
  }

  if (order.status !== "pending_payment") {
    return res.status(409).json({ success: false, error: `order_already_${order.status}` });
  }

  // Prevent the same on-chain transaction being used to pay for two
  // different orders (or an order + a wallet top-up).
  const { data: reusedOrder } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("tx_hash", tx_hash)
    .neq("id", order.id)
    .maybeSingle();
  const { data: reusedTopup } = await supabaseAdmin
    .from("wallet_topups")
    .select("id")
    .eq("tx_hash", tx_hash)
    .maybeSingle();

  if (reusedOrder || reusedTopup) {
    return res.status(409).json({ success: false, error: "tx_already_used" });
  }

  await supabaseAdmin
    .from("orders")
    .update({ status: "payment_submitted", tx_hash, updated_at: new Date().toISOString() })
    .eq("id", order.id);

  const verdict = await verifyUsdtPayment({
    txHash: tx_hash,
    expectedAmount: order.expected_amount,
  });

  if (!verdict.ok) {
    // Roll back to pending_payment so the customer (or a retry) can
    // try verification again once the tx confirms.
    await supabaseAdmin
      .from("orders")
      .update({ status: "pending_payment", updated_at: new Date().toISOString() })
      .eq("id", order.id);
    return res.status(202).json({ success: false, error: verdict.reason });
  }

  await supabaseAdmin
    .from("orders")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", order.id);

  const result = await fulfillOrder(order);
  if (!result.success) {
    return res.status(502).json({ success: false, error: result.error });
  }
  return res.status(200).json({ success: true, items: result.items });
}
