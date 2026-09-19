import { requireAdmin } from "../../../lib/requireAdmin";
import { getOrders } from "../../../lib/digitrust";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  try {
    const data = await getOrders({ limit: 30 });
    return res.status(200).json({ success: true, orders: data.orders || data });
  } catch (e) {
    return res.status(502).json({ success: false, error: e.message });
  }
}
