import "server-only";

import EasyPostClient from "@easypost/api";

import { EASYPOST_CLIENT_TIMEOUT_MS } from "./config";

/**
 * Server-only EasyPost client singleton.
 *
 * `import "server-only"` is the leak-gate: this module (and EASYPOST_API_KEY)
 * can NEVER be pulled into the client bundle — same discipline as the cart and
 * catalog data layers. The key is read from a plain server env var; it is NOT
 * NEXT_PUBLIC_ and must never be exposed to the browser.
 *
 * Module-level singleton — instantiated once per server process, reused across
 * requests. Never re-instantiate per request.
 *
 * LAZY instantiation: the SDK constructor throws "Missing required parameter:
 * API Key" if EASYPOST_API_KEY is absent. Constructing eagerly at import time
 * would break `next build` "Collecting page data" for any route that imports
 * this module before the key is set (USER SETUP). The Proxy defers construction
 * to the first real property access (a live request), so importing the module —
 * and therefore building the route — needs no key. The contract is unchanged:
 * callers still use `easypost.Shipment.create(...)` / `easypost.Address.create(...)`.
 *
 * Uses the SDK default export (`import EasyPostClient from "@easypost/api"`),
 * NOT a deep-import form.
 */
let _client;
function getClient() {
  if (!_client) {
    _client = new EasyPostClient(process.env.EASYPOST_API_KEY, {
      timeout: EASYPOST_CLIENT_TIMEOUT_MS,
    });
  }
  return _client;
}

export const easypost = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getClient();
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);
