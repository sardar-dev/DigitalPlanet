import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

// Client-side Supabase instance, using the auth-helpers cookie-based
// client (not plain @supabase/supabase-js). This matters: our API
// routes read the session via createPagesServerClient(req, res),
// which looks for the session in cookies. The plain client stores
// sessions in localStorage instead, which the server can't see —
// that mismatch is what made /api/admin/products, /api/admin/orders
// and /api/orders/create silently return "unauthenticated" even
// though the browser looked logged in.
//
// The fallback values only exist so a build never hard-crashes if
// env vars are briefly missing (e.g. during Vercel's "collecting
// page data" step) — see README if auth/data calls fail at runtime.
export const supabase = createPagesBrowserClient({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
});
