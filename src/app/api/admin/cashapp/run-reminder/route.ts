import { NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { notifyAdminOfPendingCashAppSummary } from "@/lib/admin-notify";
import { type PendingCashAppRow } from "@/lib/mailer";
import { requireAdmin } from "@/lib/api-auth";

// POST /api/admin/cashapp/run-reminder — admin-only manual trigger for
// the daily cashapp reminder. Runs the same query + fan-out as the cron
// route, gated by requireAdmin instead of CRON_SECRET. Useful for:
//   - smoke-testing the reminder pipeline post-deploy
//   - forcing a reminder before launch demo
//   - clearing the queue mid-day if admin wants the freshest list
//
// Note: this does NOT invalidate the cron — both will run independently.
// Layer-1 alerts (per-submit) still come from /api/cashapp/request.

const REMIND_AFTER_HOURS = 20;

export async function POST() {
  const adminOrRes = await requireAdmin();
  if (adminOrRes instanceof NextResponse) return adminOrRes;

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

  const rows: PendingCashAppRow[] = stale
    .map((r) => ({
      email: r.email,
      cashappUsername: r.cashappUsername,
      ageHours: r.cashappRequestedAt
        ? Math.floor((Date.now() - r.cashappRequestedAt.getTime()) / (60 * 60 * 1000))
        : 0,
    }))
    .sort((a, b) => b.ageHours - a.ageHours);

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, pending: 0, notified: false });
  }

  await notifyAdminOfPendingCashAppSummary({ rows });
  return NextResponse.json({ ok: true, pending: rows.length, notified: true });
}
