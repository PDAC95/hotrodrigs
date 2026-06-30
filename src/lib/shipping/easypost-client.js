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
 * Uses the SDK default export (`import EasyPostClient from "@easypost/api"`),
 * NOT a deep-import form.
 */
export const easypost = new EasyPostClient(process.env.EASYPOST_API_KEY, {
  timeout: EASYPOST_CLIENT_TIMEOUT_MS,
});
