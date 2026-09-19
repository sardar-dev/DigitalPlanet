import { requireAdmin } from "../../../lib/requireAdmin";
import { syncProducts } from "../../../lib/syncProducts";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "method_not_allowed" });
  }

  try {
    const result = await syncProducts();
    return res.status(200).json({ success: true, ...result });
  } catch (e) {
    return res.status(502).json({ success: false, error: e.message });
  }
}
