import { supabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  const { data } = await supabaseAdmin
    .from("app_meta")
    .select("value")
    .eq("key", "whatsapp_link")
    .maybeSingle();

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res.status(200).json({ whatsapp_link: data?.value || "" });
}
