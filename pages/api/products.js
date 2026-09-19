import { supabaseAdmin } from "../../lib/supabaseAdmin";

// Storefront reads from our local Supabase cache, never live from
// DigiTrust on every page view — that keeps us well under DigiTrust's
// 60 requests/minute limit no matter how much traffic we get. The
// cache is refreshed by /api/admin/sync (see cron setup in README).
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "method_not_allowed" });
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, title, description, sell_price, available_stock, requires_email, delivery, updated_at")
    .eq("selected", true)
    .gt("available_stock", 0)
    .order("title", { ascending: true });

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  return res.status(200).json({ success: true, products: data });
}
