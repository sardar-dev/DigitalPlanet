import { createClient } from "@supabase/supabase-js";

// Client-side Supabase instance. Uses the public anon key, which is
// safe to expose — row-level security policies in Postgres are what
// actually keep data safe, not this key.
//
// The fallback values below only exist so a build never hard-crashes
// if the env vars are momentarily missing (e.g. during Vercel's
// "collecting page data" step). If you see auth/data calls silently
// failing in the deployed app, it means the real
// NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY env vars
// are missing on the Vercel project — check Settings → Environment
// Variables, then redeploy.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
);
