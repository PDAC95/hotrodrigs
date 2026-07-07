import "server-only";

import { Resend } from "resend";

/**
 * Server-only lazy Resend client singleton — mirrors getStripe() in
 * src/lib/stripe/server.js verbatim.
 *
 * `import "server-only"` is the leak-gate: this module (and RESEND_API_KEY)
 * can NEVER be pulled into the client bundle. RESEND_API_KEY is a plain server
 * env var; it is NOT NEXT_PUBLIC_ and must never reach the browser.
 *
 * LAZY instantiation: construction is deferred to the first getResend() call —
 * a live request — so importing this module (and building any route that
 * imports it) needs no key. Note `new Resend(undefined)` does not throw at
 * construction (unlike EasyPost), but the lazy pattern is kept anyway for
 * consistency and future-proofing. The key GATE lives in sendEmail()
 * (src/lib/email/send.js), not here.
 */
let _resend;

export function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}
