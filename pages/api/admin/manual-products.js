import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

// Manual products never call DigiTrust for anything (getProduct,
// purchase, stock/price sync) — they're entirely admin-managed rows
// in our own `products` table, distinguished by provider='manual'.
// IDs are always negative (via next_manual_product_id()) so they can
// never collide with a real DigiTrust product id.
export default async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method === "GET") {
    // Reasonable limit — this is an admin tool, not a public listing.
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("provider", "manual")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, products: data });
  }

  if (req.method === "POST") {
    const {
      id, // omit to create a new product; pass to update an existing one
      title,
      description,
      sell_price,
      cost_price,
      available_stock,
      requires_email,
      delivery, // estimated delivery time text, e.g. "Within 1-6 hours"
      selected, // active/inactive
    } = req.body || {};

    // Never trust a price/stock from the client without validating
    // it server-side — these become real charges and real inventory.
    if (id === undefined) {
      // ── Create ──
      if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ success: false, error: "title_required" });
      }
      const sell = Number(sell_price);
      if (!Number.isFinite(sell) || sell <= 0) {
        return res.status(400).json({ success: false, error: "invalid_sell_price" });
      }
      const cost = cost_price === undefined ? 0 : Number(cost_price);
      if (!Number.isFinite(cost) || cost < 0) {
        return res.status(400).json({ success: false, error: "invalid_cost_price" });
      }
      const stock = Number(available_stock);
      if (!Number.isInteger(stock) || stock < 0) {
        return res.status(400).json({ success: false, error: "invalid_stock" });
      }

      const { data: newId, error: idErr } = await supabaseAdmin.rpc(
        "next_manual_product_id"
      );
      if (idErr) return res.status(500).json({ success: false, error: idErr.message });

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("products")
        .insert({
          id: newId,
          provider: "manual",
          title: title.trim(),
          description: description || null,
          sell_price: sell,
          cost_price: cost,
          real_stock: stock,
          available_stock: stock,
          requires_email: Boolean(requires_email),
          delivery: delivery || "Within 24 hours",
          selected: Boolean(selected),
        })
        .select()
        .single();

      if (insertErr) return res.status(500).json({ success: false, error: insertErr.message });
      return res.status(200).json({ success: true, product: inserted });
    }

    // ── Update ──
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("id", id)
      .eq("provider", "manual")
      .maybeSingle();
    if (existingErr) return res.status(500).json({ success: false, error: existingErr.message });
    if (!existing) return res.status(404).json({ success: false, error: "product_not_found" });

    const patch = { updated_at: new Date().toISOString() };
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ success: false, error: "title_required" });
      patch.title = title.trim();
    }
    if (description !== undefined) patch.description = description || null;
    if (sell_price !== undefined) {
      const sell = Number(sell_price);
      if (!Number.isFinite(sell) || sell <= 0) {
        return res.status(400).json({ success: false, error: "invalid_sell_price" });
      }
      patch.sell_price = sell;
    }
    if (cost_price !== undefined) {
      const cost = Number(cost_price);
      if (!Number.isFinite(cost) || cost < 0) {
        return res.status(400).json({ success: false, error: "invalid_cost_price" });
      }
      patch.cost_price = cost;
    }
    if (available_stock !== undefined) {
      const stock = Number(available_stock);
      if (!Number.isInteger(stock) || stock < 0) {
        return res.status(400).json({ success: false, error: "invalid_stock" });
      }
      patch.available_stock = stock;
      patch.real_stock = stock;
    }
    if (requires_email !== undefined) patch.requires_email = Boolean(requires_email);
    if (delivery !== undefined) patch.delivery = delivery;
    if (selected !== undefined) patch.selected = Boolean(selected);

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("products")
      .update(patch)
      .eq("id", id)
      .eq("provider", "manual")
      .select()
      .single();

    if (updateErr) return res.status(500).json({ success: false, error: updateErr.message });
    return res.status(200).json({ success: true, product: updated });
  }

  if (req.method === "DELETE") {
    // "Delete" always means archive (selected=false), never a real
    // row delete — existing orders reference this product id via a
    // foreign key, and a hard delete would break their order history.
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: "id_required" });
    const { error } = await supabaseAdmin
      .from("products")
      .update({ selected: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("provider", "manual");
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, error: "method_not_allowed" });
}
