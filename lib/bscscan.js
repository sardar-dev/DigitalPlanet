// Verifies a USDT (BEP20) payment by looking up the transaction hash
// on BscScan and checking it actually paid our wallet the right
// amount. This replaces "trust the customer's screenshot" with an
// on-chain check.

const API = "https://api.bscscan.com/api";
const USDT_DECIMALS = 18; // BEP20 USDT uses 18 decimals (unlike ERC20 USDT's 6)

function usdtRawToAmount(raw) {
  return Number(raw) / 10 ** USDT_DECIMALS;
}

async function bscRequest(params) {
  const url = new URL(API);
  Object.entries({ ...params, apikey: process.env.BSCSCAN_API_KEY }).forEach(
    ([k, v]) => url.searchParams.set(k, v)
  );
  const res = await fetch(url.toString());
  return res.json();
}

/**
 * Looks up a single BEP20 USDT transfer transaction and checks:
 *  - it exists and is a transfer of the expected USDT contract
 *  - it was sent TO our payout wallet
 *  - the amount is at least the expected amount (small float slack allowed)
 *  - it has at least MIN_CONFIRMATIONS confirmations
 *
 * Returns { ok, reason, amount, from, confirmations }.
 */
export async function verifyUsdtPayment({ txHash, expectedAmount }) {
  const contract = process.env.BSC_USDT_CONTRACT;
  const payout = (process.env.PAYOUT_WALLET_ADDRESS || "").toLowerCase();
  const minConf = Number(process.env.MIN_CONFIRMATIONS || 3);

  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return { ok: false, reason: "invalid_tx_hash" };
  }

  // Pull recent token transfers for our wallet and find the matching hash.
  // (BscScan doesn't offer "look up one tx's token transfer" directly,
  // so we filter the account's tokentx list.)
  const data = await bscRequest({
    module: "account",
    action: "tokentx",
    contractaddress: contract,
    address: payout,
    sort: "desc",
    page: 1,
    offset: 100,
  });

  if (data.status !== "1" || !Array.isArray(data.result)) {
    return { ok: false, reason: "not_found_yet" };
  }

  const tx = data.result.find(
    (t) => t.hash.toLowerCase() === txHash.toLowerCase()
  );

  if (!tx) {
    return { ok: false, reason: "not_found_yet" };
  }

  if (tx.to.toLowerCase() !== payout) {
    return { ok: false, reason: "wrong_recipient" };
  }

  const amount = usdtRawToAmount(tx.value);
  // allow a tiny float tolerance (0.001 USDT) for rounding
  if (amount + 0.001 < expectedAmount) {
    return { ok: false, reason: "amount_too_low", amount };
  }

  const blockRes = await bscRequest({
    module: "proxy",
    action: "eth_blockNumber",
  });
  const currentBlock = parseInt(blockRes.result, 16);
  const confirmations = currentBlock - Number(tx.blockNumber);

  if (confirmations < minConf) {
    return {
      ok: false,
      reason: "awaiting_confirmations",
      amount,
      confirmations,
    };
  }

  return {
    ok: true,
    amount,
    from: tx.from,
    confirmations,
  };
}
