import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../lib/requireAdmin";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "method_not_allowed" });
  }

  const { email, amount, reason } = req.body || {};
  const numAmount = Number(amount);
  if (!email || !numAmount || !reason) {
    return res.status(400).json({ success: false, error: "email_amount_reason_required" });
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("id, balance")
    .eq("email", email)
    .maybeSingle();

  if (profileErr || !profile) {
    return res.status(404).json({ success: false, error: "user_not_found" });
  }

  const { data: newBalance, error: balErr } = await supabaseAdmin.rpc(
    "increment_balance",
    { p_user_id: profile.id, p_amount: numAmount }
  );
  if (balErr) {
    return res.status(500).json({ success: false, error: balErr.message });
  }

  await supabaseAdmin.from("wallet_adjustments").insert({
    user_id: profile.id,
    amount: numAmount,
    reason,
    created_by: session.user.id,
  });

  return res.status(200).json({ success: true, balance: newBalance });
}
