import { NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { env, hasCron } from "@/lib/env";
import { sendAdminCashAppReminder, type PendingCashAppRow } from "@/lib/mailer";

// v3 §5: 24-hour CashApp SLA reminder.
//
// Vercel Cron POSTs this hourly (see vercel.json). Each run finds
// CashApp requests that have been pending for >20h (giving admin a
// 4-hour heads-up before the public 24h SLA expires) and emails
// ADMIN_NOTIFY_EMAIL one summary message. No-ops silently when the
// queue is empty so admin doesn't get inbox spam.
//
// Auth: Vercel Cron sets Authorization: Bearer <CRON_SECRET> when
// CRON_SECRET is in the project's env. We reject anything else with
// 401 so the path can't be abused.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REMIND_AFTER_HOURS = 20;
const RECIPIENT_FALLBACK = "bam@awews.com";

export async function POST(req: Request) {
  return handle(req);
}

// Vercel Cron uses GET in some configurations. Accept both so the
// schedule fires regardless of which variant the dashboard picked.
export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  if (!hasCron) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - REMIND_AFTER_HOURS * 60 * 60 * 1000);

  const stale = await db
    .select({
      email: users.email,
      cashappUsername: users.cashappUsername,
      cashappRequestedAt: users.cashappRequestedAt,
    })
    .from(users)
    .where(
      and(
        eq(users.cashappPaymentStatus, "pending"),
        lt(users.cashappRequestedAt, cutoff),
      ),
    );

  if (stale.length === 0) {
    return NextResponse.json({ ok: true, pending: 0, notified: false });
  }

  // Sort oldest-first so the email's "oldest Xh" header reflects the
  // most-urgent row.
  const rows: PendingCashAppRow[] = stale
    .map((r) => ({
      email: r.email,
      cashappUsername: r.cashappUsername,
      ageHours: r.cashappRequestedAt
        ? Math.floor((Date.now() - r.cashappRequestedAt.getTime()) / (60 * 60 * 1000))
        : 0,
    }))
    .sort((a, b) => b.ageHours - a.ageHours);

  const recipient = env.ADMIN_NOTIFY_EMAIL ?? RECIPIENT_FALLBACK;

  try {
    await sendAdminCashAppReminder({ to: recipient, rows });
  } catch (err) {
    // Don't 500 — a failed send shouldn't make Vercel Cron retry the
    // whole job (which could double-send if the mail succeeded mid-fail).
    // Log for the next run + the deploy logs.
    console.error("[cron/cashapp-reminder] reminder send failed:", err);
    return NextResponse.json(
      { ok: false, pending: rows.length, notified: false, error: String(err) },
      { status: 200 },
    );
  }

  return NextResponse.json({
    ok: true,
    pending: rows.length,
    notified: true,
    recipient,
  });
}
