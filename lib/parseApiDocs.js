/**
 * parseApiDocs — zero-dependency, no-API-key parser.
 *
 * Paste any supplier's API docs (or a raw JSON response) and this returns
 * a partial form-state object that can be merged straight into the
 * ApiConnectionsTab form fields.
 *
 * Strategy: scan the raw text with a cascade of heuristics.  Every field
 * has a confidence tag so the UI can warn about low-confidence guesses.
 */

// ─── tiny helpers ────────────────────────────────────────────────────────────

function lines(text) {
  return text.split(/\r?\n/);
}

/** Return first regex match group 1, or null. */
function first(text, ...patterns) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1]?.trim() || null;
  }
  return null;
}

/** Find all matches of a pattern across the whole text. */
function all(text, pattern) {
  return [...text.matchAll(new RegExp(pattern.source, pattern.flags + (pattern.flags.includes("g") ? "" : "g")))];
}

/** Dot-path access. */
function pick(obj, path) {
  if (!path) return obj;
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

/** Try to parse JSON anywhere in a string. */
function tryJson(raw) {
  const s = raw.replace(/```json|```/gi, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  const c = s.indexOf("["), d = s.lastIndexOf("]");
  for (const [from, to] of [[a, b], [c, d]]) {
    if (from >= 0 && to > from) {
      try { return JSON.parse(s.slice(from, to + 1)); } catch {}
    }
  }
  return null;
}

// ─── extract base URL ────────────────────────────────────────────────────────

function extractBaseUrl(text) {
  // Full HTTPS URLs in the text
  const urls = all(text, /https:\/\/[a-z0-9._-]+(?:\/[^\s"'<>?#)]*)?/i);
  const candidates = urls.map(m => m[0]);

  if (!candidates.length) return { value: "", confidence: "none" };

  // Try to find the "root" API prefix that appears most often
  const hosts = candidates.map(u => {
    try { return new URL(u).origin; } catch { return null; }
  }).filter(Boolean);

  const freq = {};
  for (const h of hosts) freq[h] = (freq[h] || 0) + 1;
  const topHost = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Find the longest common prefix path across all URLs from the top host
  const fromTop = candidates.filter(u => u.startsWith(topHost));
  const paths = fromTop.map(u => {
    try { return new URL(u).pathname; } catch { return "/"; }
  });

  // Common path segments
  let base = topHost;
  if (paths.length > 1) {
    const segs = paths[0].split("/").filter(Boolean);
    for (let i = segs.length; i >= 1; i--) {
      const prefix = "/" + segs.slice(0, i).join("/");
      if (paths.every(p => p.startsWith(prefix))) {
        // Don't include the last segment if it looks like an endpoint name
        const last = segs[i - 1];
        if (!/products|balance|order|auth|token|resell/i.test(last)) {
          base = topHost + prefix;
        } else {
          base = topHost + "/" + segs.slice(0, i - 1).join("/");
        }
        break;
      }
    }
  }

  return {
    value: base.replace(/\/+$/, ""),
    confidence: fromTop.length >= 2 ? "high" : "medium",
  };
}

// ─── extract auth ────────────────────────────────────────────────────────────

function extractAuth(text) {
  const low = text.toLowerCase();

  // Bearer token signals
  if (/bearer\s+token|authorization:\s*bearer|auth.*bearer/i.test(text))
    return { auth_type: "bearer", auth_header: "", auth_prefix: "", confidence: "high" };

  // Custom header signals
  const headerMatch = text.match(/['"](x-api-key|x-auth-token|x-access-token|api-key|api_key)['"\s]|header[^:]*:\s*([A-Z][A-Za-z-]{3,30})/);
  if (headerMatch) {
    const h = (headerMatch[1] || headerMatch[2] || "X-API-Key").trim();
    return { auth_type: "header", auth_header: h, auth_prefix: "", confidence: "high" };
  }

  // Query param signals
  const qMatch = text.match(/[?&]([a-z_]{3,20}(?:key|token|auth|api)[a-z_]{0,10})=/i);
  if (qMatch)
    return { auth_type: "query", auth_header: qMatch[1], auth_prefix: "", confidence: "medium" };

  if (/basic\s+auth|base64/i.test(low))
    return { auth_type: "basic", auth_header: "", auth_prefix: "", confidence: "medium" };

  return { auth_type: "bearer", auth_header: "", auth_prefix: "", confidence: "low" };
}

// ─── extract endpoint paths ──────────────────────────────────────────────────

/**
 * For each endpoint type, try to find its path relative to the base URL.
 * Returns { products_path, balance_path, order_path } with confidences.
 */
function extractEndpoints(text, baseUrl) {
  const urlRe = /https?:\/\/[^\s"'<>)]+/gi;
  const urls = [...text.matchAll(urlRe)].map(m => m[0]);

  function toPath(fullUrl) {
    if (!baseUrl) return fullUrl;
    try {
      const u = new URL(fullUrl);
      const b = new URL(baseUrl);
      if (u.origin !== b.origin) return null;
      let path = u.pathname;
      if (b.pathname !== "/" && path.startsWith(b.pathname)) {
        path = path.slice(b.pathname.length) || "/";
      }
      const qs = u.search;
      return (path || "/") + qs;
    } catch { return null; }
  }

  function findFor(keywords, method) {
    // 1. Look for a URL on a line containing these keywords
    const kRe = new RegExp(keywords.join("|"), "i");
    const methodRe = method ? new RegExp(`\\b${method}\\b`, "i") : null;

    for (const line of lines(text)) {
      if (!kRe.test(line)) continue;
      if (methodRe && !methodRe.test(line)) continue;
      const urlInLine = line.match(/https?:\/\/[^\s"'<>)]+/);
      if (urlInLine) {
        const p = toPath(urlInLine[0]);
        if (p) return { value: p, confidence: "high" };
      }
      // path-only (starts with / or ?)
      const pathInLine = line.match(/(?:path|url|endpoint)[^:]*:\s*([/?][^\s"'<>]+)/i)
        || line.match(/[`'"](\/[a-z0-9/_?=&-]+)[`'"]/i);
      if (pathInLine) return { value: pathInLine[1], confidence: "high" };
    }

    // 2. scan for URLs that contain keyword hints
    for (const u of urls) {
      if (kRe.test(u)) {
        const p = toPath(u);
        if (p) return { value: p, confidence: "medium" };
      }
    }
    return { value: null, confidence: "none" };
  }

  return {
    products: findFor(["product", "catalog", "catalogue", "items", "list"], "GET"),
    balance: findFor(["balance", "wallet", "credit", "fund"], "GET"),
    order: findFor(["order", "purchase", "buy", "checkout"], "POST"),
  };
}

// ─── extract field names from sample JSON ───────────────────────────────────

/**
 * Given the raw text, find JSON objects that look like product records and
 * try to infer the correct field names.
 */
function extractFieldNames(text) {
  // Find all JSON-looking blocks
  const blocks = [];
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") { if (depth === 0) start = i; depth++; }
    else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        blocks.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  // Find array blocks too
  const arrBlocks = [];
  depth = 0; start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "[") { if (depth === 0) start = i; depth++; }
    else if (text[i] === "]") {
      depth--;
      if (depth === 0 && start >= 0) {
        arrBlocks.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  const parsed = [...blocks, ...arrBlocks].map(b => tryJson(b)).filter(Boolean);

  // Flatten: if obj has array values, look inside them
  const records = [];
  for (const p of parsed) {
    if (Array.isArray(p)) {
      for (const item of p.slice(0, 3)) if (item && typeof item === "object") records.push(item);
    } else if (typeof p === "object") {
      // Push top-level obj
      records.push(p);
      // Push any array values inside it
      for (const v of Object.values(p)) {
        if (Array.isArray(v)) {
          for (const item of v.slice(0, 3)) if (item && typeof item === "object") records.push(item);
        }
      }
    }
  }

  // Score fields by likelihood they represent each concept
  const scores = {
    id:    ["id", "product_id", "pid", "item_id", "sku", "code", "numeric_id"],
    title: ["name", "title", "product_name", "item_name", "label", "display_name"],
    price: ["price", "cost", "amount", "rate", "wholesale_price", "unit_price"],
    stock: ["stock", "quantity", "qty", "available", "inventory", "in_stock"],
    items: ["items", "keys", "accounts", "codes", "credentials", "delivery", "data", "result"],
    order_id: ["order_id", "id", "transaction_id", "ref", "reference", "external_order_id"],
  };

  const result = {};
  for (const [concept, candidates] of Object.entries(scores)) {
    for (const rec of records) {
      const keys = Object.keys(rec);
      for (const c of candidates) {
        if (keys.includes(c)) {
          result[concept] = result[concept] || { value: c, confidence: "medium" };
          // Higher confidence if it's in the first candidate slot
          if (candidates.indexOf(c) === 0) {
            result[concept] = { value: c, confidence: "high" };
          }
          break;
        }
      }
    }
  }

  // Detect items_path: find top-level key whose value is an array of product-like objects
  let items_path = { value: "", confidence: "low" };
  for (const p of parsed) {
    if (typeof p === "object" && !Array.isArray(p)) {
      for (const [k, v] of Object.entries(p)) {
        if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") {
          // Check if array items look like products
          const item = v[0];
          const hasId = Object.keys(item).some(k2 => /\bid\b|product_id/i.test(k2));
          const hasPrice = Object.keys(item).some(k2 => /price|cost|amount/i.test(k2));
          if (hasId || hasPrice) {
            items_path = { value: k, confidence: "high" };
            break;
          }
        }
      }
    }
  }

  // Detect balance value path (may be nested like reseller.balance)
  let balance_field = { value: "balance", confidence: "low" };
  for (const p of parsed) {
    if (typeof p === "object" && !Array.isArray(p)) {
      // Direct balance key
      if ("balance" in p) {
        balance_field = { value: "balance", confidence: "high" };
        break;
      }
      // Nested: look one level deep
      for (const [k, v] of Object.entries(p)) {
        if (v && typeof v === "object" && "balance" in v) {
          balance_field = { value: `${k}.balance`, confidence: "high" };
          break;
        }
      }
    }
  }

  // Order body: detect external_order_id field name
  let order_id_field = "external_order_id";
  const orderIdMatch = text.match(/"(external_order_id|client_order_id|request_id|ref_id|idempotency_key|order_ref)":/);
  if (orderIdMatch) order_id_field = orderIdMatch[1];

  return { ...result, items_path, balance_field, order_id_field };
}

// ─── main export ─────────────────────────────────────────────────────────────

/**
 * parseApiDocs(text) → partialFormState
 *
 * Returns an object with the same keys as the ApiConnectionsTab form,
 * plus a `_meta` object describing confidence levels and any warnings.
 */
export function parseApiDocs(text) {
  if (!text || typeof text !== "string" || text.trim().length < 20) {
    return { _meta: { ok: false, error: "Paste some API documentation first." } };
  }

  const warnings = [];

  // ── base URL ──
  const urlResult = extractBaseUrl(text);
  if (urlResult.confidence === "none") warnings.push("Could not find a base URL. Fill it in manually.");

  // ── auth ──
  const auth = extractAuth(text);
  if (auth.confidence === "low") warnings.push("Auth type guessed as Bearer — check if the docs show a different method.");

  // ── endpoints ──
  const endpoints = extractEndpoints(text, urlResult.value);
  const products_path = endpoints.products.value || "/?action=products";
  const balance_path = endpoints.balance.value || "/?action=balance";
  const order_path = endpoints.order.value || "/?action=order";

  if (!endpoints.products.value) warnings.push("Could not detect the products endpoint path — left as default.");
  if (!endpoints.balance.value) warnings.push("Could not detect the balance endpoint path — left as default.");
  if (!endpoints.order.value) warnings.push("Could not detect the order endpoint path — left as default.");

  // ── field names ──
  const fields = extractFieldNames(text);

  // Build order body based on detected order_id field name
  const orderIdKey = fields.order_id_field || "external_order_id";

  // Detect if idempotent (external order id exists)
  const isIdempotent = /idempotent|retry.*same.*id|same.*id.*return/i.test(text);

  const form = {
    base_url:         urlResult.value,
    auth_type:        auth.auth_type,
    auth_header:      auth.auth_header,
    auth_prefix:      auth.auth_prefix,
    products_path,
    balance_path,
    order_path,
    items_path:       fields.items_path?.value ?? "",
    field_id:         fields.id?.value ?? "id",
    field_title:      fields.title?.value ?? "name",
    field_price:      fields.price?.value ?? "price",
    field_stock:      fields.stock?.value ?? "stock",
    balance_field:    fields.balance_field?.value ?? "balance",
    order_items_path: fields.items?.value ?? "items",
    order_id_path:    fields.order_id?.value ?? "order_id",
    // Build config with correct order body field names
    _orderIdKey:      orderIdKey,
    _isIdempotent:    isIdempotent,
  };

  const confidences = {
    base_url:      urlResult.confidence,
    auth_type:     auth.confidence,
    products_path: endpoints.products.confidence,
    balance_path:  endpoints.balance.confidence,
    order_path:    endpoints.order.confidence,
    items_path:    fields.items_path?.confidence ?? "low",
    field_id:      fields.id?.confidence ?? "low",
    field_price:   fields.price?.confidence ?? "low",
    balance_field: fields.balance_field?.confidence ?? "low",
  };

  // Overall quality score
  const highCount = Object.values(confidences).filter(v => v === "high").length;
  const total = Object.keys(confidences).length;
  const quality = highCount >= total * 0.7 ? "good" : highCount >= total * 0.4 ? "partial" : "low";

  return {
    ...form,
    _meta: {
      ok: true,
      quality,
      confidences,
      warnings,
    },
  };
}
