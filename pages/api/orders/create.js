import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getProduct, applyStockBuffer } from "../../../lib/digitrust";

// Step 1 of checkout: customer picks a product + quantity. We
// re-check LIVE stock on DigiTrust (not just our cache) before we
// even quote a payment amount, so we never ask someone to pay for
// something that just sold out elsewhere.
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

  const { product_id, quantity = 1, email } = req.body || {};
  if (!product_id || quantity < 1) {
    return res.status(400).json({ success: false, error: "invalid_request" });
  }

  const { data: localProduct, error: localErr } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("id", product_id)
    .eq("selected", true)
    .single();

  if (localErr || !localProduct) {
    return res.status(404).json({ success: false, error: "product_not_available" });
  }

  if (localProduct.requires_email && !email) {
    return res.status(400).json({ success: false, error: "email_required" });
  }

  // Live recheck: for DigiTrust products, re-check against DigiTrust
  // itself (buffer applied). For manual products, DigiTrust is never
  // called — we just re-read our own stock, which is the source of
  // truth (the real atomic decrement happens later, at payment
  // confirmation, via decrement_manual_stock).
  let availableNow;
  if (localProduct.provider === "manual") {
    availableNow = localProduct.available_stock;
  } else {
    try {
      const { product } = await getProduct(product_id);
      availableNow = applyStockBuffer(product).available_stock;
    } catch (e) {
      return res.status(502).json({ success: false, error: "stock_check_failed" });
    }
  }

  if (availableNow < quantity) {
    return res.status(409).json({
      success: false,
      error: "not_enough_stock",
      available: availableNow,
    });
  }

  const unitPrice = Number(localProduct.sell_price);
  const total = Number((unitPrice * quantity).toFixed(4));

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: session.user.id,
      product_id,
      quantity,
      unit_price: unitPrice,
      total,
      email: email || null,
      status: "pending_payment",
      payout_wallet: process.env.PAYOUT_WALLET_ADDRESS,
      expected_amount: total,
    })
    .select()
    .single();

  if (orderErr) {
    return res.status(500).json({ success: false, error: orderErr.message });
  }

  return res.status(200).json({ success: true, order });
}
