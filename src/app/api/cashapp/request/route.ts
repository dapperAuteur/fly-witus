import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { requireUser } from "@/lib/api-auth";

// POST /api/cashapp/request — user submits their CashApp username after
// sending payment via the CashApp app. Admin reviews + activates from
// /admin/cashapp (next branch).
//
// Refuses if the user is already lifetime (no point) or has a pending
// request still in flight (avoids dupe rows; user should ping admin
// instead of resubmitting). A previously rejected user CAN re-submit
// — overwrites the rejected record with a new pending one.

const bodySchema = z.object({
  // CashApp usernames start with $ and are 1–20 chars of letters/digits.
  // Strip a leading $ if present so we don't double up when displayed.
  cashappUsername: z
    .string()
    .min(1, "Enter your CashApp username")
    .max(32, "Username too long"),
});

export async function POST(req: Request) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const cashappUsername = normalizeCashAppUsername(parsed.data.cashappUsername);

  const [existing] = await db
    .select({
      accountTier: users.accountTier,
      cashappPaymentStatus: users.cashappPaymentStatus,
    })
    .from(users)
    .where(eq(users.id, userOrRes.id))
    .limit(1);

  if (existing?.accountTier === "lifetime") {
    return NextResponse.json(
      {
        error: "You already have a lifetime account.",
        code: "ALREADY_LIFETIME",
      },
      { status: 409 },
    );
  }

  if (existing?.cashappPaymentStatus === "pending") {
    return NextResponse.json(
      {
        error:
          "You already have a pending CashApp request. Admin will review within 24 hours.",
        code: "ALREADY_PENDING",
      },
      { status: 409 },
    );
  }

  await db
    .update(users)
    .set({
      cashappUsername,
      cashappPaymentStatus: "pending",
      cashappRequestedAt: new Date(),
      // Clear prior reject metadata if the user is re-submitting after a
      // rejection, so the admin queue shows a clean pending row.
      cashappActivatedAt: null,
      cashappActivatedBy: null,
      cashappRejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userOrRes.id));

  return NextResponse.json({ ok: true });
}

function normalizeCashAppUsername(raw: string): string {
  const trimmed = raw.trim();
  // Allow either "$Foo" or "Foo" — store with the leading $ for display
  // consistency in the admin queue.
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
}
