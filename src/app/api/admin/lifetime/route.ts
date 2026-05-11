import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { lifetimeSlotCounter } from "@/db/schema/commerce";
import { requireAdmin } from "@/lib/api-auth";

const updateSchema = z.object({
  standardSlotsTotal: z.number().int().min(0).max(10000),
  standardSlotsUsed: z.number().int().min(0),
});

// PATCH /api/admin/lifetime — adjust the standard-100 counter. Promo
// reopens have their own slot pool stored on promos.lifetimeSlotsUsed.
export async function PATCH(req: Request) {
  const adminOrRes = await requireAdmin();
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.standardSlotsUsed > parsed.data.standardSlotsTotal) {
    return NextResponse.json(
      { error: "Used cannot exceed total" },
      { status: 400 },
    );
  }

  await db
    .update(lifetimeSlotCounter)
    .set({
      standardSlotsTotal: parsed.data.standardSlotsTotal,
      standardSlotsUsed: parsed.data.standardSlotsUsed,
      updatedAt: new Date(),
    })
    .where(eq(lifetimeSlotCounter.id, 1));

  return NextResponse.json({ ok: true });
}
