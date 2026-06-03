// Fan-out for help-bubble submissions. Mirrors src/lib/admin-notify.ts:
// each channel is independent and individually try/catch'd so a failure
// on one (Mailgun blip, Inbox down) never blocks the user's 201 or the
// other channels. The DB write is the source of truth and happens in the
// route before this is called.
//
//   Channel 1 — Email     (always-on baseline, to the admin)
//   Channel 2 — WitUS Inbox (cross-product bus → triage/SMS routing).
//               Capability-gated by hasInbox, so it's a safe no-op until
//               INBOX_INGEST_* is configured (operator task #10).

import { env } from "./env";
import { feedbackTypeLabel, type FeedbackType } from "./feedback-api";
import { pushToInbox, type InboxPriority } from "./inbox";
import { sendEmail } from "./mailer";

const FALLBACK_RECIPIENT = "bam@awews.com";
const ADMIN_QUEUE_URL = "https://fly.witus.online/admin/feedback";

function adminRecipient(): string {
  return env.ADMIN_NOTIFY_EMAIL ?? FALLBACK_RECIPIENT;
}

// Bugs jump the queue: high priority is the Inbox-side signal to escalate
// to SMS. Feedback/questions ride normal priority.
function inboxPriority(type: FeedbackType): InboxPriority {
  return type === "bug" ? "high" : "normal";
}

export interface FeedbackNotifyInput {
  submissionId: string;
  type: FeedbackType;
  message: string;
  pageUrl?: string | null;
  userAgent?: string | null;
  submitterEmail?: string | null;
}

export async function notifyOfFeedback(input: FeedbackNotifyInput): Promise<void> {
  const label = feedbackTypeLabel(input.type);
  const recipient = adminRecipient();
  const submitter = input.submitterEmail || "anonymous";

  // Channel 1 — admin email. Wrapped so a Mailgun failure can't bubble.
  await sendEmail({
    to: recipient,
    subject: `[Fly WitUS] New ${label} from ${submitter}`,
    text: [
      `Type:    ${label}`,
      `From:    ${submitter}`,
      `Page:    ${input.pageUrl ?? "—"}`,
      `Agent:   ${input.userAgent ?? "—"}`,
      ``,
      input.message,
      ``,
      `Triage queue: ${ADMIN_QUEUE_URL}`,
    ].join("\n"),
  }).catch((err) => {
    console.error("[feedback-notify] email failed:", err);
  });

  // Channel 2 — WitUS Inbox. pushToInbox already no-ops + fail-softs when
  // hasInbox is false, so no guard needed here.
  await pushToInbox({
    form_type: `fly_witus_${input.type}`,
    submitter_email: input.submitterEmail ?? undefined,
    priority: inboxPriority(input.type),
    payload: {
      submissionId: input.submissionId,
      type: input.type,
      message: input.message,
      pageUrl: input.pageUrl ?? undefined,
      userAgent: input.userAgent ?? undefined,
      adminQueueUrl: ADMIN_QUEUE_URL,
    },
  });
}
