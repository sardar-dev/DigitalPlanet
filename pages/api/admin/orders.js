import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*, products(title)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, orders: data });
  }

  if (req.method === "POST") {
    // Body: { id, status } — manual override, e.g. marking a failed
    // order as "refunded" once you've sent the USDT back by hand.
    const { id, status } = req.body || {};
    const allowed = ["refunded", "failed", "delivered"];
    if (!id || !allowed.includes(status)) {
      return res.status(400).json({ success: false, error: "invalid_request" });
    }
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, error: "method_not_allowed" });
}
