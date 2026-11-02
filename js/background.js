/**
 * @fileoverview Background service worker for SearchPopup.
 *
 * This is the only context that talks to the exchange-rate and crypto APIs.
 *
 * Why: a content script issues requests on behalf of the page origin, so the
 * host page's Content Security Policy (`connect-src`) and CORS apply to them.
 * On strict-CSP sites (YouTube, GitHub, ...) those requests never leave the
 * browser and Chromium logs:
 *   "Unsafe attempt to load URL ... from frame with URL ..."
 * Requests made from the extension origin (this worker) are governed by the
 * extension CSP and host_permissions instead.
 *
 * Security: the content script never supplies a URL. It names an endpoint and,
 * for crypto, a validated coin-id list plus quote currency. This prevents a
 * malicious page from abusing the message handler as an open cross-origin proxy.
 *
 * @requires chrome.runtime.onMessage
 * @requires host_permissions for api.exchangerate-api.com, open.er-api.com,
 *   api.coingecko.com
 */

// ===== CONFIGURATION =====

/** Fixed, allowlisted API URLs. Content scripts cannot extend this map. */
const API_ENDPOINTS = {
  "exchange-rates": "https://api.exchangerate-api.com/v4/latest/EUR",
  "exchange-rates-fallback": "https://open.er-api.com/v6/latest/EUR",
};

const CRYPTO_ENDPOINT = "https://api.coingecko.com/api/v3/simple/price";

/** CoinGecko id list: lowercase slugs (hyphens allowed) separated by commas. */
const CRYPTO_IDS_PATTERN = /^[a-z0-9-]+(?:,[a-z0-9-]+)*$/;

/** CoinGecko quote currency: lowercase ISO code. */
const CRYPTO_VS_PATTERN = /^[a-z]{2,5}$/;

// ===== REQUEST HANDLING =====

/**
 * Concurrent frames ask for the same rates at the same time (the content script
 * runs in every frame). Share one request per URL so N iframes cost one API
 * call instead of N.
 * @type {Map<string, Promise<{ok: boolean, status: number, data?: any, error?: string}>>}
 */
const inFlight = new Map();

/**
 * Build the URL for an allowlisted endpoint.
 * @param {string} endpoint - Endpoint name supplied by the content script
 * @param {{ids?: string, vs?: string}} [params] - Crypto query parameters
 * @returns {string|null} URL, or null when the request is not allowlisted
 */
function buildUrl(endpoint, params = {}) {
  if (Object.prototype.hasOwnProperty.call(API_ENDPOINTS, endpoint)) {
    return API_ENDPOINTS[endpoint];
  }

  if (endpoint === "crypto") {
    const ids = String(params.ids || "");
    const vs = String(params.vs || "");
    if (!CRYPTO_IDS_PATTERN.test(ids) || !CRYPTO_VS_PATTERN.test(vs)) {
      return null;
    }
    return `${CRYPTO_ENDPOINT}?ids=${ids}&vs_currencies=${vs}`;
  }

  return null;
}

/**
 * Fetch JSON with a normalized result shape, de-duplicating concurrent calls.
 * @param {string} url - Allowlisted API URL
 * @returns {Promise<{ok: boolean, status: number, data?: any, error?: string}>}
 */
function fetchJson(url) {
  const pending = inFlight.get(url);
  if (pending) return pending;

  const request = fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      return { ok: true, status: response.status, data: await response.json() };
    })
    .catch((error) => ({
      ok: false,
      status: 0,
      error: error && error.message ? error.message : String(error),
    }))
    .finally(() => inFlight.delete(url));

  inFlight.set(url, request);
  return request;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "searchpopup:fetch-json") return;

  const url = buildUrl(message.endpoint, message.params);
  if (!url) {
    sendResponse({ ok: false, status: 0, error: "Unknown API endpoint" });
    return;
  }

  fetchJson(url).then(sendResponse);
  return true; // Keep the message channel open for the async response.
});
