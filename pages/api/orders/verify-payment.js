import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { verifyUsdtPayment } from "../../../lib/bscscan";
import { getProduct, applyStockBuffer, purchase } from "../../../lib/digitrust";

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
  // different orders.
  const { data: reused } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("tx_hash", tx_hash)
    .neq("id", order.id)
    .maybeSingle();

  if (reused) {
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
    // Roll back to pending_payment so the customer (or a retry / the
    // sync cron) can try verification again once the tx confirms.
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

  // Final live stock check, then buy for real. If DigiTrust is out of
  // stock at this exact moment, the order is marked failed and money
  // stays with us pending a manual refund — it was never at risk of
  // being spent twice since DigiTrust only takes one purchase at a
  // time per key.
  try {
    const { product } = await getProduct(order.product_id);
    const live = applyStockBuffer(product);
    if (live.available_stock < order.quantity) {
      await supabaseAdmin
        .from("orders")
        .update({
          status: "failed",
          failure_reason: "out_of_stock_at_fulfillment",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      return res.status(409).json({ success: false, error: "out_of_stock_refund_pending" });
    }

    const result = await purchase({
      productId: order.product_id,
      quantity: order.quantity,
      email: order.email || undefined,
    });

    await supabaseAdmin
      .from("orders")
      .update({
        status: "delivered",
        digitrust_order_id: result.order.id,
        items: result.order.items,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return res.status(200).json({ success: true, items: result.order.items });
  } catch (e) {
    await supabaseAdmin
      .from("orders")
      .update({
        status: "failed",
        failure_reason: e.message || "fulfillment_error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    return res.status(502).json({ success: false, error: "fulfillment_failed_refund_pending" });
  }
}
