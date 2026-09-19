import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Checks the request's Supabase session belongs to a profile with
 * is_admin = true. Returns the session on success, or null (and
 * already writes a 401/403 response) on failure — so callers can do:
 *
 *   const session = await requireAdmin(req, res);
 *   if (!session) return;
 */
export async function requireAdmin(req, res) {
  const supabaseServer = createPagesServerClient({ req, res });
  const {
    data: { session },
  } = await supabaseServer.auth.getSession();

  if (!session) {
    res.status(401).json({ success: false, error: "login_required" });
    return null;
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .single();

  if (!profile?.is_admin) {
    res.status(403).json({ success: false, error: "admin_only" });
    return null;
  }

  return session;
}
