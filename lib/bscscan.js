// Verifies USDT (BEP20) payments by looking up transaction hashes
// on-chain via the Etherscan API V2 unified endpoint (chainid=56 for
// BNB Smart Chain). This replaces "trust the customer's screenshot"
// with an on-chain check.
//
// Note: the old standalone BscScan API (api.bscscan.com) was
// deprecated in August 2025. Everything now goes through Etherscan's
// unified V2 API with a chainid parameter, using a free key from
// etherscan.io/apis (NOT bscscan.com/myapikey — that key format does
// not work here, ETHERSCAN_API_KEY is the only key this file reads).

const API = "https://api.etherscan.io/v2/api";
const CHAIN_ID = 56; // BNB Smart Chain
const USDT_DECIMALS = 18; // BEP20 USDT uses 18 decimals (unlike ERC20 USDT's 6)

function usdtRawToAmount(raw) {
  return Number(raw) / 10 ** USDT_DECIMALS;
}

async function bscRequest(params) {
  const url = new URL(API);
  Object.entries({
    ...params,
    chainid: CHAIN_ID,
    apikey: process.env.ETHERSCAN_API_KEY,
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

/**
 * Low-level lookup: finds a tx hash in our wallet's incoming USDT
 * transfer history and returns everything about it, with NO business
 * rules applied (no amount/expected checks) — those live in the two
 * wrapper functions below. Also used by the admin debug tool so a
 * human can see exactly what the chain says without guessing.
 */
export async function lookupUsdtTransfer(txHash) {
  const contract = process.env.BSC_USDT_CONTRACT;
  const payout = (process.env.PAYOUT_WALLET_ADDRESS || "").toLowerCase();

  if (!process.env.ETHERSCAN_API_KEY) {
    return { found: false, reason: "etherscan_api_key_missing" };
  }
  if (!process.env.BSC_USDT_CONTRACT) {
    return { found: false, reason: "usdt_contract_missing" };
  }
  if (!payout) {
    return { found: false, reason: "payout_wallet_missing" };
  }
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return { found: false, reason: "invalid_tx_hash" };
  }

  const data = await bscRequest({
    module: "account",
    action: "tokentx",
    contractaddress: contract,
    address: payout,
    sort: "desc",
    page: 1,
    offset: 100,
  });

  // status "0" + message "No transactions found" is a normal empty
  // state (nothing to our wallet yet, or not this token). Anything
  // else with status "0" is a real API problem (bad key, wrong
  // params, rate limit) — surface it distinctly instead of
  // pretending the tx just isn't there yet.
  if (data.status !== "1") {
    if (data.message === "No transactions found") {
      return { found: false, reason: "not_found_yet", raw: data };
    }
    return {
      found: false,
      reason: "chain_lookup_failed",
      detail: data.message || data.result || "unknown error",
      raw: data,
    };
  }

  if (!Array.isArray(data.result)) {
    return { found: false, reason: "not_found_yet", raw: data };
  }

  const tx = data.result.find(
    (t) => t.hash.toLowerCase() === txHash.toLowerCase()
  );

  if (!tx) {
    return {
      found: false,
      reason: "not_found_yet",
      // helps debugging: how many transfers we DID see for this wallet
      transfersSeen: data.result.length,
    };
  }

  if (tx.to.toLowerCase() !== payout) {
    return { found: true, reason: "wrong_recipient", tx };
  }

  const blockRes = await bscRequest({ module: "proxy", action: "eth_blockNumber" });
  const currentBlock = parseInt(blockRes.result, 16);
  const confirmations = currentBlock - Number(tx.blockNumber);

  return {
    found: true,
    ok: true,
    amount: usdtRawToAmount(tx.value),
    from: tx.from,
    to: tx.to,
    confirmations,
    blockNumber: tx.blockNumber,
  };
}

/**
 * Order checkout: verifies a tx paid at least `expectedAmount` with
 * enough confirmations. Returns { ok, reason, amount, from, confirmations }.
 */
export async function verifyUsdtPayment({ txHash, expectedAmount }) {
  const minConf = Number(process.env.MIN_CONFIRMATIONS || 3);
  const result = await lookupUsdtTransfer(txHash);

  if (!result.found) return { ok: false, reason: result.reason, detail: result.detail };
  if (result.reason === "wrong_recipient") return { ok: false, reason: "wrong_recipient" };

  if (result.amount + 0.001 < expectedAmount) {
    return { ok: false, reason: "amount_too_low", amount: result.amount };
  }
  if (result.confirmations < minConf) {
    return {
      ok: false,
      reason: "awaiting_confirmations",
      amount: result.amount,
      confirmations: result.confirmations,
    };
  }
  return { ok: true, amount: result.amount, from: result.from, confirmations: result.confirmations };
}

/**
 * Wallet top-up: same on-chain check, but ANY amount is accepted
 * (whatever the customer sent gets credited to their balance 1:1).
 */
export async function verifyUsdtTopup({ txHash }) {
  const minConf = Number(process.env.MIN_CONFIRMATIONS || 3);
  const result = await lookupUsdtTransfer(txHash);

  if (!result.found) return { ok: false, reason: result.reason, detail: result.detail };
  if (result.reason === "wrong_recipient") return { ok: false, reason: "wrong_recipient" };

  if (result.confirmations < minConf) {
    return {
      ok: false,
      reason: "awaiting_confirmations",
      amount: result.amount,
      confirmations: result.confirmations,
    };
  }
  return { ok: true, amount: result.amount, from: result.from, confirmations: result.confirmations };
}
