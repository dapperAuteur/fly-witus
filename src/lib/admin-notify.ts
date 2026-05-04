// Admin notification fan-out for the CashApp flow.
//
// Two layers ride this module:
//   Layer 1 — on-submit (per /api/cashapp/request POST)
//   Layer 2 — daily cron sweep (per /api/cron/cashapp-reminder)
//
// Each layer calls the matching helper here. Channels are independent +
// individually try/catch'd: a failure on one channel never blocks the
// others or the user-facing response. Email is the always-on baseline;
// Inbox push is capability-gated on hasInbox and is what carries the
// SMS escalation downstream.

import { env } from "./env";
import { pushToInbox } from "./inbox";
import {
  sendAdminCashAppNewRequestEmail,
  sendAdminCashAppReminder,
  type PendingCashAppRow,
} from "./mailer";

const ADMIN_QUEUE_URL = "https://fly.witus.online/admin/cashapp";
const FALLBACK_RECIPIENT = "bam@awews.com";

function adminRecipient(): string {
  return env.ADMIN_NOTIFY_EMAIL ?? FALLBACK_RECIPIENT;
}

// Layer 1 — fired by /api/cashapp/request after the DB write.
export async function notifyAdminOfNewCashAppRequest(input: {
  userEmail: string;
  userId: string;
  cashappUsername: string;
  requestedAt: Date;
}): Promise<void> {
  const recipient = adminRecipient();

  // Email — always-on. Wrapped so a Mailgun blip can't block the
  // 200 response to the pilot who just paid.
  await sendAdminCashAppNewRequestEmail({
    to: recipient,
    userEmail: input.userEmail,
    cashappUsername: input.cashappUsername,
  }).catch((err) => {
    console.error("[admin-notify] new-request email failed:", err);
  });

  // Inbox push — capability-gated; pushToInbox returns early when
  // hasInbox is false. priority: 'high' is the Inbox-side signal to
  // escalate to SMS via mobile-text-alerts.
  await pushToInbox({
    form_type: "cashapp_request_new",
    submitter_email: input.userEmail,
    priority: "high",
    payload: {
      userId: input.userId,
      cashappUsername: input.cashappUsername,
      requestedAt: input.requestedAt.toISOString(),
      adminQueueUrl: ADMIN_QUEUE_URL,
    },
  });
}

// Layer 2 — fired by /api/cron/cashapp-reminder daily.
export async function notifyAdminOfPendingCashAppSummary(input: {
  rows: PendingCashAppRow[];
}): Promise<void> {
  if (input.rows.length === 0) return;

  const recipient = adminRecipient();

  await sendAdminCashAppReminder({ to: recipient, rows: input.rows }).catch(
    (err) => {
      console.error("[admin-notify] reminder email failed:", err);
    },
  );

  await pushToInbox({
    form_type: "cashapp_request_pending_summary",
    priority: "high",
    payload: {
      pendingCount: input.rows.length,
      oldestAgeHours: input.rows[0]?.ageHours ?? 0,
      rows: input.rows,
      adminQueueUrl: ADMIN_QUEUE_URL,
    },
  });
}
