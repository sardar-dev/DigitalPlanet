import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return; // requireAdmin already sent the response

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .order("title", { ascending: true });
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, products: data });
  }

  if (req.method === "POST") {
    // Body: { id, selected?, sell_price? } — update one product's
    // storefront visibility and/or our markup price.
    const { id, selected, sell_price } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: "id_required" });

    const patch = { updated_at: new Date().toISOString() };
    if (typeof selected === "boolean") patch.selected = selected;
    if (typeof sell_price === "number") patch.sell_price = sell_price;

    const { error } = await supabaseAdmin.from("products").update(patch).eq("id", id);
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, error: "method_not_allowed" });
}
