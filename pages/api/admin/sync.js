import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getAllProducts, applyStockBuffer } from "../../../lib/digitrust";

// Called on a schedule (see vercel.json cron) to refresh our local
// product cache from DigiTrust. This is what keeps the storefront's
// prices/stock current without hammering DigiTrust's API on every
// visitor — and where the stock buffer gets applied.
//
// Existing sell_price / selected flags are preserved for products we
// already have; only new products come in unselected with sell_price
// defaulted to DigiTrust's price (admin should adjust markup after).
export default async function handler(req, res) {
  // Vercel Cron automatically sends "Authorization: Bearer <CRON_SECRET>"
  // when a CRON_SECRET env var is set on the project. We also accept a
  // manual header/query value for local testing.
  const bearer = (req.headers.authorization || "").replace("Bearer ", "");
  const secret = bearer || req.headers["x-cron-secret"] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  let remote;
  try {
    remote = await getAllProducts();
  } catch (e) {
    return res.status(502).json({ success: false, error: e.message });
  }

  const { data: existing } = await supabaseAdmin
    .from("products")
    .select("id, sell_price, selected");

  const existingById = new Map((existing || []).map((p) => [p.id, p]));

  const rows = remote.products.map((p) => {
    const buffered = applyStockBuffer(p);
    const current = existingById.get(p.id);
    return {
      id: p.id,
      title: p.title,
      cost_price: p.special_price?.price ?? p.price,
      sell_price: current ? current.sell_price : p.special_price?.price ?? p.price,
      real_stock: buffered.real_stock,
      available_stock: buffered.available_stock,
      requires_email: p.requires_email,
      delivery: p.delivery,
      selected: current ? current.selected : false,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabaseAdmin.from("products").upsert(rows);

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  return res.status(200).json({ success: true, synced: rows.length });
}
