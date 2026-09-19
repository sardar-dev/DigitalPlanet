import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service role key. This
// bypasses Row Level Security, so it must NEVER be imported into any
// file that ships to the browser — only inside /pages/api/* handlers
// or getServerSideProps.
//
// Fallback values exist only to stop a build-time crash if env vars
// are briefly unavailable — actual requests will fail with an auth
// error until SUPABASE_SERVICE_ROLE_KEY is really set in Vercel.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key",
  { auth: { persistSession: false } }
);
