import { NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { env, hasCron } from "@/lib/env";
import { notifyAdminOfPendingCashAppSummary } from "@/lib/admin-notify";
import { type PendingCashAppRow } from "@/lib/mailer";

// v3 §5: 24-hour CashApp SLA reminder — Layer 2 safety net.
//
// Vercel Cron POSTs this once daily (see vercel.json — Hobby plan caps
// crons at 24h intervals). Each run finds CashApp requests that have
// been pending for >20h (giving admin a 4-hour heads-up before the
// public 24h SLA expires) and fires the same admin-notify fan-out as
// Layer 1: email always, Inbox push when configured (which routes to
// SMS via mobile-text-alerts). No-ops silently when the queue is empty
// so admin doesn't get inbox spam.
//
// Layer 1 (per-submit alerting) lives in /api/cashapp/request. This
// cron is the safety net — catches any submission whose Layer-1 alert
// admin missed or dismissed.
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

  // Fan-out (email + Inbox push when configured). admin-notify wraps
  // each channel in try/catch internally so a flaky vendor can't make
  // Vercel Cron retry the whole job (which could double-send).
  await notifyAdminOfPendingCashAppSummary({ rows });

  return NextResponse.json({
    ok: true,
    pending: rows.length,
    notified: true,
    recipient: env.ADMIN_NOTIFY_EMAIL ?? RECIPIENT_FALLBACK,
  });
}
