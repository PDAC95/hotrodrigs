import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "./client";

/**
 * Key-gated, never-throwing send wrapper — mirrors the calcTax() degrade
 * discipline (EML-04): no key -> skip loudly-but-gracefully; API error or
 * thrown exception -> log a grep-able [email] line and return a failure
 * result. A caller inside the Stripe webhook must NEVER 500 because of
 * email code.
 *
 * RESEND_FROM / RESEND_API_KEY are read INSIDE the function (late-bound env,
 * never module scope) so a keyless `next build` and a key added at runtime
 * both behave correctly.
 *
 * @param {{ to: string, subject: string, html: string, idempotencyKey?: string }} param0
 * @returns {Promise<{ sent: true, id: string } | { sent: false, skipped: string } | { sent: false, error: unknown }>}
 */
export async function sendEmail({ to, subject, html, idempotencyKey }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY not set — skipping "${subject}" to ${to}`);
    return { sent: false, skipped: "no_key" };
  }
  const FROM = process.env.RESEND_FROM || "Hot Rod Rigs <onboarding@resend.dev>";
  try {
    // resend@6.17.1 declares the second-arg options form:
    // send(payload: CreateEmailOptions, options?: CreateEmailRequestOptions)
    // where CreateEmailRequestOptions extends IdempotentRequest { idempotencyKey }.
    const { data, error } = await getResend().emails.send(
      { from: FROM, to, subject, html },
      { idempotencyKey } // 24h window, max 256 chars, pattern <event-type>/<entity-id>
    );
    if (error) {
      console.error(`[email] send failed ("${subject}" to ${to}):`, error);
      return { sent: false, error };
    }
    return { sent: true, id: data.id };
  } catch (err) {
    console.error(`[email] send threw ("${subject}" to ${to}):`, err?.message);
    return { sent: false, error: err };
  }
}

/**
 * Claim-then-send idempotency helper shared by ALL three email types
 * (EML-04's core mechanism). The sent_emails UNIQUE(order_number, email_type)
 * constraint arbitrates concurrent webhook deliveries at the DB level:
 *
 *  1. Claim the (orderNumber, emailType) pair via upsert + ignoreDuplicates.
 *     0 rows back = another process already claimed -> skip. A claim ERROR
 *     also skips — never send unguarded.
 *  2. Send through sendEmail() with a deterministic Resend idempotencyKey
 *     (e.g. "order-confirmation/HRR-10021") as the second line of defense.
 *  3. On success, record the resend_id on the claimed row (best-effort).
 *     On failure OR no_key skip, best-effort release the claim (delete) so a
 *     no-key dev run or transient failure doesn't permanently burn it —
 *     Resend's 24h idempotencyKey covers the crack where the delete itself
 *     fails.
 *
 * NEVER throws.
 *
 * @param {{ orderNumber: string, emailType: string, to: string, subject: string, html: string }} param0
 * @returns {Promise<{ sent: true, id: string } | { sent: false, skipped?: string, error?: unknown }>}
 */
export async function sendOnce({ orderNumber, emailType, to, subject, html }) {
  try {
    const admin = createAdminClient();

    // 1. Claim — the DB arbitrates duplicates.
    const { data: claim, error: claimError } = await admin
      .from("sent_emails")
      .upsert(
        { order_number: orderNumber, email_type: emailType, recipient: to },
        { onConflict: "order_number,email_type", ignoreDuplicates: true }
      )
      .select();

    if (claimError) {
      console.error(
        `[email] claim failed for ${emailType} ${orderNumber} — not sending unguarded:`,
        claimError
      );
      return { sent: false, skipped: "already_sent" };
    }
    if (!claim || claim.length === 0) {
      return { sent: false, skipped: "already_sent" };
    }

    // 2. Send — deterministic key: "order-confirmation/HRR-10021" (strip "#").
    const idempotencyKey = `${emailType.replace(/_/g, "-")}/${String(orderNumber).replace(/^#/, "")}`;
    const result = await sendEmail({ to, subject, html, idempotencyKey });

    if (result.sent) {
      // 3a. Record the provider id on the claim (best-effort).
      const { error: updateError } = await admin
        .from("sent_emails")
        .update({ resend_id: result.id })
        .match({ order_number: orderNumber, email_type: emailType });
      if (updateError) {
        console.warn(
          `[email] could not record resend_id for ${emailType} ${orderNumber} (non-fatal):`,
          updateError
        );
      }
      return result;
    }

    // 3b. Failure or no_key skip: best-effort release so a manual re-drive
    // (or a keyed dev run after a no-key one) can retry.
    const { error: releaseError } = await admin
      .from("sent_emails")
      .delete()
      .match({ order_number: orderNumber, email_type: emailType });
    if (releaseError) {
      console.warn(
        `[email] could not release claim for ${emailType} ${orderNumber} (idempotencyKey covers the 24h crack):`,
        releaseError
      );
    }
    return result;
  } catch (err) {
    console.error(
      `[email] sendOnce threw for ${emailType} ${orderNumber} (non-fatal):`,
      err?.message
    );
    return { sent: false, error: err };
  }
}
