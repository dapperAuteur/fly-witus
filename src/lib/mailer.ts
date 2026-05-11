import FormData from "form-data";
import Mailgun from "mailgun.js";
import { env } from "./env";

const defaultFrom = "Fly WitUS <noreply@fly.witus.online>";

type MailgunClient = ReturnType<InstanceType<typeof Mailgun>["client"]>;

let cached: MailgunClient | undefined;

function getClient(): MailgunClient | null {
  const apiKey = env.MAILGUN_API_KEY;
  if (!apiKey) return null;
  if (cached) return cached;
  const mailgun = new Mailgun(FormData);
  cached = mailgun.client({
    username: "api",
    key: apiKey,
    url: env.MAILGUN_REGION === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net",
  });
  return cached;
}

// Accept the two shapes Mailgun's RFC 5322 parser accepts from us:
//   bare addr-spec:      noreply@example.com
//   display + <addr>:    Name <noreply@example.com>  or  "Name" <noreply@example.com>
// Reject everything else here so the failure surfaces with the actual value
// instead of Mailgun's opaque "from parameter is not a valid address".
const fromRegex =
  /^(?:(?:"[^"]+"|[^"<>]+)\s+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/;

function normalizeFrom(raw: string): string {
  // Vercel env vars preserve literal quotes — a value pasted as
  //   "Name <x@y>"
  // becomes process.env.EMAIL_FROM === '"Name <x@y>"', which Mailgun reads
  // as a quoted-string with no addr-spec. Strip one layer of matching
  // outer quotes so a common paste mistake doesn't page anyone.
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function resolveFrom(): string {
  const candidate = env.EMAIL_FROM ? normalizeFrom(env.EMAIL_FROM) : defaultFrom;
  if (!fromRegex.test(candidate)) {
    throw new Error(
      `EMAIL_FROM is not a valid RFC 5322 address: ${JSON.stringify(candidate)}. ` +
        `Expected either "name@domain" or "Display Name <name@domain>" (no outer quotes).`,
    );
  }
  return candidate;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const client = getClient();
  const domain = env.MAILGUN_DOMAIN;
  const from = resolveFrom();

  if (!client || !domain) {
    if (env.NODE_ENV !== "production") {
      console.warn(
        `[mailer:dev-fallback] No MAILGUN_API_KEY or MAILGUN_DOMAIN set. Would have sent:\n` +
          `  from:    ${from}\n` +
          `  to:      ${input.to}\n` +
          `  subject: ${input.subject}\n` +
          `  body:    ${input.text}`,
      );
      return;
    }
    throw new Error(
      "MAILGUN_API_KEY and MAILGUN_DOMAIN are required in production to send email",
    );
  }

  try {
    await client.messages.create(domain, {
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  } catch (err) {
    // Re-throw with the actual values we tried. Mailgun's raw error
    // ("from parameter is not a valid address") doesn't tell you what was
    // sent, and from/domain are the two values most likely wrong.
    console.error(
      `[mailer] Mailgun rejected send. from=${JSON.stringify(from)} ` +
        `domain=${JSON.stringify(domain)} to=${JSON.stringify(input.to)}`,
    );
    throw err;
  }
}

// v3 §1 magic-link template. 15-min expiry copy comes from the brief.
export async function sendMagicLinkEmail(input: { to: string; url: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Your Fly WitUS sign-in link",
    text:
      `Click the link below to sign in to Fly WitUS. This link expires in 15 minutes.\n\n` +
      `${input.url}\n\n` +
      `If you didn't request this, you can ignore this email.`,
    html:
      `<p>Click the link below to sign in to Fly WitUS. This link expires in 15 minutes.</p>` +
      `<p><a href="${input.url}">Sign in to Fly WitUS</a></p>` +
      `<p style="color:#666;font-size:12px">If you didn't request this, you can ignore this email.</p>`,
  });
}

// v3 §2B confirmation email — sent when admin verifies a CashApp payment
// and activates the user's lifetime tier.
export async function sendCashAppActivatedEmail(input: { to: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Your Fly WitUS Lifetime Account is Active",
    text:
      `Your payment has been verified and your lifetime account is now active.\n\n` +
      `Sign in at https://fly.witus.online to access all features.\n\n` +
      `Questions? Reply to this email.\n\n` +
      `— BAM, Fly WitUS`,
    html:
      `<p>Your payment has been verified and your lifetime account is now active.</p>` +
      `<p><a href="https://fly.witus.online">Sign in at fly.witus.online</a> to access all features.</p>` +
      `<p>Questions? Reply to this email.</p>` +
      `<p>— BAM, Fly WitUS</p>`,
  });
}

// v3 §2B rejection email — sent when admin rejects a CashApp payment
// (could not match the transaction, wrong amount, etc.). Reason comes
// from the admin form so the user knows what to fix.
export async function sendCashAppRejectedEmail(input: {
  to: string;
  reason: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "About your Fly WitUS payment",
    text:
      `We couldn't verify your CashApp payment for a Fly WitUS lifetime account.\n\n` +
      `Reason: ${input.reason}\n\n` +
      `If you think this was a mistake, please reply to this email with details.\n` +
      `Otherwise, you can re-submit at https://fly.witus.online/cashapp/request after re-sending payment.\n\n` +
      `— BAM, Fly WitUS`,
    html:
      `<p>We couldn't verify your CashApp payment for a Fly WitUS lifetime account.</p>` +
      `<p><strong>Reason:</strong> ${escapeHtml(input.reason)}</p>` +
      `<p>If you think this was a mistake, please reply to this email with details.</p>` +
      `<p>Otherwise, you can <a href="https://fly.witus.online/cashapp/request">re-submit</a> after re-sending payment.</p>` +
      `<p>— BAM, Fly WitUS</p>`,
  });
}

// Minimal HTML escape so admin-supplied rejection reasons can't inject
// arbitrary markup into the email body.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// v3 §2B + Layer-1 alerting — fires the moment a user submits a CashApp
// request via /api/cashapp/request. Lets admin see the queue immediately
// instead of waiting on the daily cron sweep. The Inbox push (separate
// channel) handles SMS escalation; this email is the always-on baseline.
export async function sendAdminCashAppNewRequestEmail(input: {
  to: string;
  userEmail: string;
  cashappUsername: string;
}): Promise<void> {
  const safeUser = escapeHtml(input.userEmail);
  const safeUsername = escapeHtml(input.cashappUsername);
  await sendEmail({
    to: input.to,
    subject: `New CashApp request: ${input.userEmail}`,
    text:
      `A pilot just submitted a CashApp lifetime request.\n\n` +
      `User:    ${input.userEmail}\n` +
      `CashApp: ${input.cashappUsername}\n\n` +
      `Verify the payment in CashApp, then activate via the admin queue:\n` +
      `https://fly.witus.online/admin/cashapp\n\n` +
      `24-hour SLA — confirm within a day.`,
    html:
      `<p>A pilot just submitted a CashApp lifetime request.</p>` +
      `<ul>` +
      `<li><strong>User:</strong> ${safeUser}</li>` +
      `<li><strong>CashApp:</strong> <code>${safeUsername}</code></li>` +
      `</ul>` +
      `<p>Verify the payment in CashApp, then ` +
      `<a href="https://fly.witus.online/admin/cashapp">activate via the admin queue</a>.</p>` +
      `<p style="color:#666;font-size:12px">24-hour SLA — confirm within a day.</p>`,
  });
}

// v3 §3 — fires when a claimant links a completed mission to a flight
// request. Requester gets the heads-up so they can pull the asset (BVC
// footage, etc.) without having to poll the group feed.
export async function sendFlightRequestCompletedEmail(input: {
  to: string;
  requesterName: string;
  claimantName: string;
  groupName: string;
  requestTitle: string;
  missionLocation: string | null;
  missionDate: Date;
  missionDurationLabel?: string | null;
  groupId: string;
}): Promise<void> {
  const safeReq = escapeHtml(input.requesterName);
  const safeClaim = escapeHtml(input.claimantName);
  const safeGroup = escapeHtml(input.groupName);
  const safeTitle = escapeHtml(input.requestTitle);
  const safeLoc = escapeHtml(input.missionLocation ?? "Unknown location");
  const dateLabel = input.missionDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const url = `https://fly.witus.online/groups/${input.groupId}`;
  await sendEmail({
    to: input.to,
    subject: `Flight request completed — ${input.requestTitle}`,
    text:
      `${input.claimantName} has completed your flight request and shared the mission with ${input.groupName}.\n\n` +
      `Request: ${input.requestTitle}\n` +
      `Mission: ${input.missionLocation ?? "Unknown location"}\n` +
      `Date:    ${dateLabel}\n` +
      (input.missionDurationLabel ? `Duration: ${input.missionDurationLabel}\n` : "") +
      `\nView the shared mission: ${url}\n\n` +
      `— Fly WitUS`,
    html:
      `<p>Hi ${safeReq},</p>` +
      `<p><strong>${safeClaim}</strong> has completed your flight request and shared the mission with <strong>${safeGroup}</strong>.</p>` +
      `<ul>` +
      `<li><strong>Request:</strong> ${safeTitle}</li>` +
      `<li><strong>Mission:</strong> ${safeLoc}</li>` +
      `<li><strong>Date:</strong> ${escapeHtml(dateLabel)}</li>` +
      (input.missionDurationLabel
        ? `<li><strong>Duration:</strong> ${escapeHtml(input.missionDurationLabel)}</li>`
        : "") +
      `</ul>` +
      `<p><a href="${url}">View the shared mission</a></p>` +
      `<p>— Fly WitUS</p>`,
  });
}

// v3 §5 — admin gets one daily-or-so summary of CashApp requests still
// pending past 20h so the 24h SLA never silently slips. Recipient is
// ADMIN_NOTIFY_EMAIL (defaults to bam@awews.com).
export interface PendingCashAppRow {
  email: string;
  cashappUsername: string | null;
  ageHours: number;
}

export async function sendAdminCashAppReminder(input: {
  to: string;
  rows: PendingCashAppRow[];
}): Promise<void> {
  if (input.rows.length === 0) return;

  const oldest = input.rows[0]; // caller orders newest-first or oldest-first; we just take row[0] for the subject hint
  const summary = input.rows.length === 1 ? "1 request" : `${input.rows.length} requests`;
  const subject = `⚠️ ${summary} pending CashApp activation (oldest ${oldest.ageHours}h)`;

  const lines = input.rows
    .map(
      (r) =>
        `  • ${r.email}  ${r.cashappUsername ?? "(no username)"}  ${r.ageHours}h ago`,
    )
    .join("\n");

  const html =
    `<p>${escapeHtml(summary)} pending CashApp activation past the 24-hour SLA window:</p>` +
    `<ul>` +
    input.rows
      .map(
        (r) =>
          `<li><strong>${escapeHtml(r.email)}</strong> — <code>${escapeHtml(
            r.cashappUsername ?? "(no username)",
          )}</code> — ${r.ageHours}h ago</li>`,
      )
      .join("") +
    `</ul>` +
    `<p><a href="https://fly.witus.online/admin/cashapp">Open the admin queue</a> to verify.</p>`;

  await sendEmail({
    to: input.to,
    subject,
    text:
      `${summary} pending CashApp activation past the 24-hour SLA window:\n\n` +
      `${lines}\n\n` +
      `Open the admin queue: https://fly.witus.online/admin/cashapp`,
    html,
  });
}
