import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service role key. This
// bypasses Row Level Security, so it must NEVER be imported into any
// file that ships to the browser — only inside /pages/api/* handlers
// or getServerSideProps.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
