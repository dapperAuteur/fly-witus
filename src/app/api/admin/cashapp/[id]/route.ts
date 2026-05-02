import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { requireAdmin } from "@/lib/api-auth";
import { sendCashAppActivatedEmail, sendCashAppRejectedEmail } from "@/lib/mailer";
import { incrementLifetimeSlotsUsed } from "@/lib/stripe";

const bodySchema = z.union([
  z.object({ action: z.literal("activate") }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().min(1, "Reason required").max(500),
  }),
]);

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: Params) {
  const adminOrRes = await requireAdmin();
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [target] = await db
    .select({
      id: users.id,
      email: users.email,
      cashappPaymentStatus: users.cashappPaymentStatus,
      accountTier: users.accountTier,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.cashappPaymentStatus !== "pending") {
    // Idempotency guard: a row can be activated/rejected only from
    // pending. Re-activating an already-verified user would double-credit
    // the slot counter. The admin UI hides actions for non-pending
    // rows; this is the server-side belt+suspenders.
    return NextResponse.json(
      {
        error: `Cannot ${parsed.data.action} — request is not pending (current: ${target.cashappPaymentStatus ?? "none"}).`,
      },
      { status: 409 },
    );
  }

  if (parsed.data.action === "activate") {
    // Increment the standard lifetime slot pool atomically. If the pool
    // is exhausted (race or admin opened a manual lifetime past the
    // cap), we still grant the tier — the user already paid via CashApp
    // and admin manually verified — and log a warning so admin can
    // raise the slot total to absorb this row.
    const slotResult = await incrementLifetimeSlotsUsed();
    if (!slotResult) {
      console.warn(
        "[admin/cashapp/activate] lifetime slot pool exhausted at activate time; still granting tier",
        { userId: id, by: adminOrRes.id },
      );
    }

    await db
      .update(users)
      .set({
        accountTier: "lifetime",
        tierExpiresAt: null,
        cashappPaymentStatus: "verified",
        cashappActivatedAt: new Date(),
        cashappActivatedBy: adminOrRes.id,
        cashappRejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    // Email failure shouldn't roll back the activation — the row in the
    // DB is the source of truth. Log so admin can manually re-send if
    // needed.
    try {
      await sendCashAppActivatedEmail({ to: target.email });
    } catch (err) {
      console.error("[admin/cashapp/activate] activation email failed:", err);
    }

    return NextResponse.json({ ok: true });
  }

  // action === "reject"
  await db
    .update(users)
    .set({
      cashappPaymentStatus: "rejected",
      cashappRejectionReason: parsed.data.reason,
      cashappActivatedAt: null,
      cashappActivatedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));

  try {
    await sendCashAppRejectedEmail({ to: target.email, reason: parsed.data.reason });
  } catch (err) {
    console.error("[admin/cashapp/reject] rejection email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
