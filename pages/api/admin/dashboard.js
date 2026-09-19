import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";
import { getBalance } from "../../../lib/digitrust";

const LOW_BALANCE_THRESHOLD = Number(process.env.LOW_BALANCE_THRESHOLD || 5);

export default async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  let digitrustBalance = null;
  let digitrustBalanceError = null;
  try {
    const b = await getBalance();
    digitrustBalance = b.balance ?? b.wallet_balance ?? b;
  } catch (e) {
    digitrustBalanceError = e.message;
  }

  const { data: meta } = await supabaseAdmin
    .from("app_meta")
    .select("value")
    .eq("key", "last_sync")
    .maybeSingle();

  // Sales/profit summary. Cost is based on each product's CURRENT
  // DigiTrust price (we don't store the historical cost at time of
  // sale), so this is an approximation, not an exact ledger — good
  // enough for a quick health check.
  const { data: delivered } = await supabaseAdmin
    .from("orders")
    .select("total, quantity, product_id, products(cost_price)")
    .eq("status", "delivered");

  let totalSales = 0;
  let totalCost = 0;
  for (const o of delivered || []) {
    totalSales += Number(o.total);
    totalCost += Number(o.products?.cost_price || 0) * o.quantity;
  }

  return res.status(200).json({
    success: true,
    digitrust: {
      balance: digitrustBalance,
      error: digitrustBalanceError,
      low: digitrustBalance !== null && digitrustBalance < LOW_BALANCE_THRESHOLD,
      threshold: LOW_BALANCE_THRESHOLD,
    },
    lastSync: meta?.value || null,
    sales: {
      ordersDelivered: (delivered || []).length,
      totalSales: Number(totalSales.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      profit: Number((totalSales - totalCost).toFixed(2)),
    },
  });
}
