import { requireAdmin } from "../../../lib/requireAdmin";
import { lookupUsdtTransfer } from "../../../lib/bscscan";

// Lets an admin paste any tx hash and see exactly what the on-chain
// lookup returns — which env var is missing, whether the tx was seen
// at all, how many transfers we found for our wallet, the recipient
// mismatch, etc. This turns "payment verification isn't working"
// into something you can self-diagnose instead of guessing.
export default async function handler(req, res) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "method_not_allowed" });
  }

  const { tx_hash } = req.body || {};
  if (!tx_hash) {
    return res.status(400).json({ success: false, error: "tx_hash_required" });
  }

  try {
    const result = await lookupUsdtTransfer(tx_hash);
    return res.status(200).json({
      success: true,
      env: {
        ETHERSCAN_API_KEY_set: Boolean(process.env.ETHERSCAN_API_KEY),
        BSC_USDT_CONTRACT: process.env.BSC_USDT_CONTRACT || null,
        PAYOUT_WALLET_ADDRESS: process.env.PAYOUT_WALLET_ADDRESS || null,
        MIN_CONFIRMATIONS: process.env.MIN_CONFIRMATIONS || "3 (default)",
      },
      result,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
