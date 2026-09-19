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
    await supabaseAdmin
      .from("orders")
      .update({
        status: "failed",
        failure_reason: e.message || "fulfillment_error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    return { success: false, error: "fulfillment_failed_refund_pending" };
  }
}
