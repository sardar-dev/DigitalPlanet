import { supabaseAdmin } from "./supabaseAdmin";
import { getProduct, applyStockBuffer, purchase } from "./digitrust";

/**
 * Call this once an order's payment is already confirmed (status
 * "paid"). Does a final live stock check, buys from DigiTrust, and
 * stores the delivered items — or marks the order "failed" if
 * DigiTrust is out of stock at this exact moment (rare, since
 * DigiTrust only allows one purchase in flight per key).
 *
 * Returns { success, items } or { success: false, error }.
 */
export async function fulfillOrder(order) {
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
      return { success: false, error: "out_of_stock_refund_pending" };
    }

    // Mark "fulfilling" before the real purchase call, so if the
    // server crashes mid-request an admin can see this order was
    // last known to be actively purchasing (not just sitting paid).
    await supabaseAdmin
      .from("orders")
      .update({ status: "fulfilling", updated_at: new Date().toISOString() })
      .eq("id", order.id);

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

    return { success: true, items: result.order.items };
  } catch (e) {
    // A network error/timeout means we genuinely don't know whether
    // DigiTrust processed the purchase — do NOT mark this "failed"
    // (which implies safe to refund), since the product might have
    // actually been delivered on their end. Flag it for a human to
    // check DigiTrust's own order history before deciding.
    const status = e.ambiguous ? "needs_reconciliation" : "failed";
    await supabaseAdmin
      .from("orders")
      .update({
        status,
        failure_reason: e.message || "fulfillment_error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    return {
      success: false,
      error: e.ambiguous
        ? "fulfillment_uncertain_pending_review"
        : "fulfillment_failed_refund_pending",
    };
  }
}
