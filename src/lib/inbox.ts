// WitUS Inbox push client.
//
// Fires events to the cross-product Inbox bus at INBOX_INGEST_URL. The
// Inbox project (witus-inbox repo) verifies the HMAC + dispatches each
// event to its own configured downstream channels — including SMS via
// mobile-text-alerts when priority='high'. fly-witus only labels and
// posts; channel routing is Inbox's responsibility.
//
// Auth: HMAC-SHA256 over `${timestamp}.${rawBody}` using the per-source
// secret. 5-minute replay window enforced server-side. See the
// witus-inbox webhook contract docs + reference impl at
// witus-inbox/examples/sender.ts.
//
// Fail-soft: every error is caught, logged, and swallowed. The caller
// (admin-notify.ts) treats Inbox as best-effort — a flaky Inbox can't
// block the user's CashApp submission flow or break the cron sweep.

import { createHmac } from "node:crypto";
import { env, hasInbox } from "./env";

export type InboxPriority = "low" | "normal" | "high" | "urgent";

export interface InboxEvent {
  form_type: string;
  submitter_email?: string;
  submitter_name?: string;
  priority?: InboxPriority;
  payload?: Record<string, unknown>;
}

const REQUEST_TIMEOUT_MS = 5_000;

export async function pushToInbox(event: InboxEvent): Promise<void> {
  if (!hasInbox) {
    // Capability gate — leave the post-merge env-population a deploy-time
    // task instead of a code change. See plans/user-tasks/10-… for the
    // BAM-side wiring.
    return;
  }

  const url = env.INBOX_INGEST_URL!;
  const secret = env.INBOX_INGEST_SECRET!;
  const sourceSlug = env.INBOX_SOURCE_SLUG!;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const rawBody = JSON.stringify(event);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "X-Witus-Source": sourceSlug,
        "X-Witus-Timestamp": timestamp,
        "X-Witus-Signature": `sha256=${signature}`,
      },
      body: rawBody,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `[inbox] push rejected: HTTP ${res.status} for ${event.form_type}`,
        text.slice(0, 200),
      );
    }
  } catch (err) {
    console.warn(`[inbox] push failed for ${event.form_type}:`, err);
  }
}
