import { createClient } from "@supabase/supabase-js";

// Client-side Supabase instance. Uses the public anon key, which is
// safe to expose — row-level security policies in Postgres are what
// actually keep data safe, not this key.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
