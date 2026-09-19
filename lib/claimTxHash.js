import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Atomically claims a tx hash so nothing else can use it while we
 * verify it. This is a single INSERT into a table whose primary key
 * is the lowercased hash — Postgres guarantees only one concurrent
 * INSERT of the same value can ever succeed, so this is what
 * actually prevents:
 *   - the same tx being submitted to two different orders
 *   - the same tx being used for an order AND a wallet top-up
 *   - a double-click / two parallel requests both "succeeding"
 *   - 0xABC... and 0xabc... being treated as different hashes
 *
 * Returns { claimed: true } if we got it, { claimed: false } if it
 * was already claimed by someone else.
 */
export async function claimTxHash(txHash, usedByType, usedById) {
  const normalized = txHash.toLowerCase();
  const { error } = await supabaseAdmin.from("used_tx_hashes").insert({
    tx_hash: normalized,
    used_by_type: usedByType,
    used_by_id: usedById || null,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") return { claimed: false }; // unique_violation
    throw error;
  }
  return { claimed: true };
}

/** Marks a claimed hash as permanently confirmed (payment verified). */
export async function confirmTxHash(txHash) {
  await supabaseAdmin
    .from("used_tx_hashes")
    .update({ status: "confirmed" })
    .eq("tx_hash", txHash.toLowerCase());
}

/**
 * Releases a claimed hash so it can be retried — use this when
 * verification failed for a retryable reason (tx not found yet,
 * awaiting confirmations, or the on-chain check itself errored). A
 * hash is only ever left permanently burned once a payment is
 * actually confirmed.
 */
export async function releaseTxHash(txHash) {
  await supabaseAdmin
    .from("used_tx_hashes")
    .delete()
    .eq("tx_hash", txHash.toLowerCase())
    .eq("status", "pending"); // never release a confirmed one
}
