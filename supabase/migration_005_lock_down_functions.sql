-- Run this in Supabase SQL Editor. Closes a real hole in
-- migration_003: SECURITY DEFINER functions default to EXECUTE
-- granted to PUBLIC in Postgres, which includes Supabase's `anon`
-- and `authenticated` roles. Since these functions bypass RLS by
-- design (that's what SECURITY DEFINER means), any logged-in user
-- could otherwise call them directly via supabase.rpc(...) from the
-- browser — e.g. crediting their own balance with any amount,
-- bypassing all tx-hash verification entirely.
--
-- Our server code only ever calls these via the service_role key
-- (see lib usage of supabaseAdmin.rpc(...)), so revoking PUBLIC/anon/
-- authenticated access here breaks nothing legitimate.

revoke all on function public.increment_balance(uuid, numeric)
  from public, anon, authenticated;

revoke all on function public.decrement_balance_if_enough(uuid, numeric)
  from public, anon, authenticated;

grant execute on function public.increment_balance(uuid, numeric)
  to service_role;

grant execute on function public.decrement_balance_if_enough(uuid, numeric)
  to service_role;
