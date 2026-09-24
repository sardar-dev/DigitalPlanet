import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method === "GET") {
    const { data } = await supabaseAdmin
      .from("app_meta")
      .select("value")
      .eq("key", "whatsapp_link")
      .maybeSingle();
    return res.status(200).json({ success: true, whatsapp_link: data?.value || "" });
  }

  if (req.method === "POST") {
    const { whatsapp_link } = req.body || {};
    if (whatsapp_link && !/^https?:\/\//i.test(whatsapp_link)) {
      return res.status(400).json({ success: false, error: "invalid_url" });
    }
    const { error } = await supabaseAdmin
      .from("app_meta")
      .upsert({ key: "whatsapp_link", value: whatsapp_link || "", updated_at: new Date().toISOString() });
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, error: "method_not_allowed" });
}
