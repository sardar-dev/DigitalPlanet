import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { fulfillOrder } from "../../../lib/fulfillOrder";

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

  const { order_id } = req.body || {};
  if (!order_id) {
    return res.status(400).json({ success: false, error: "order_id_required" });
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

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("balance")
    .eq("id", session.user.id)
    .single();

  const balance = Number(profile?.balance || 0);
  if (balance < order.total) {
    return res.status(402).json({ success: false, error: "insufficient_balance", balance });
  }

  // Deduct first. If fulfillment fails, the shared fulfillOrder()
  // already marks the order "failed" for manual refund — a deducted
  // balance on a failed order is the wallet equivalent of that same
  // manual-refund process described in the README.
  await supabaseAdmin
    .from("profiles")
    .update({ balance: balance - order.total })
    .eq("id", session.user.id);

  await supabaseAdmin
    .from("orders")
    .update({
      status: "paid",
      paid_with: "wallet_balance",
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  const result = await fulfillOrder(order);
  if (!result.success) {
    return res.status(502).json({ success: false, error: result.error });
  }
  return res.status(200).json({ success: true, items: result.items });
}
