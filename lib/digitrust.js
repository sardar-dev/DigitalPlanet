// Thin wrapper around the DigiTrust reseller API.
// Every call to DigiTrust goes through here so retry/error handling
// and the API key stay in one place. Never import this from a page
// or client component — server-side only (it holds a secret key).

const BASE = process.env.DIGITRUST_API_BASE;
const KEY = process.env.DIGITRUST_API_KEY;

async function call(path, options = {}) {
  if (!BASE || !KEY) {
    throw new Error("DIGITRUST_API_BASE or DIGITRUST_API_KEY is not set");
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "X-API-Key": KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.success === false) {
    const err = new Error(data.error || `DigiTrust API error (${res.status})`);
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}

/** All products priced for our account. */
export function getAllProducts() {
  return call("/products");
}

/** Live recheck of one product right before we commit to a purchase. */
export function getProduct(id) {
  return call(`/product/${id}`);
}

/** Wallet balance left to spend on DigiTrust. */
export function getBalance() {
  return call("/balance");
}

/**
 * Buy from DigiTrust. Only call this after our own payment (USDT) has
 * been verified — this is the step that actually spends real balance
 * and delivers real stock.
 */
export function purchase({ productId, quantity = 1, email }) {
  return call("/purchase", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      quantity,
      ...(email ? { email } : {}),
    }),
  });
}

export function getOrders({ limit = 20, offset = 0 } = {}) {
  return call(`/orders?limit=${limit}&offset=${offset}`);
}

export function getOrder(id) {
  return call(`/order/${id}`);
}

/**
 * Applies our safety buffer to a raw DigiTrust product so we never
 * show more than we can actually deliver if several buyers race us.
 * A product only appears storefront-side when the buffered quantity
 * is greater than 0 (i.e. real stock is strictly above the buffer).
 */
export function applyStockBuffer(product, buffer = Number(process.env.STOCK_BUFFER || 2)) {
  const available = Math.max(0, (product.stock ?? 0) - buffer);
  return {
    ...product,
    real_stock: product.stock,
    available_stock: available,
    in_stock: available > 0,
  };
}
