import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { promos } from "@/db/schema/commerce";
import { requireAdmin } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  bannerText: z.string().trim().max(280).nullable().optional(),
  // Slot adjustment (lifetime_reopen)
  lifetimeSlots: z.number().int().positive().nullable().optional(),
  // Discount caps
  maxRedemptions: z.number().int().positive().nullable().optional(),
});

// PATCH — limited edits. Pricing/code mutations are deliberately not
// allowed here because they'd require Stripe coupon recreation and
// in-flight checkout sessions could see the old price.
export async function PATCH(req: Request, { params }: Ctx) {
  const adminOrRes = await requireAdmin();
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
  if (parsed.data.startsAt !== undefined) {
    updates.startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
  }
  if (parsed.data.endsAt !== undefined) {
    updates.endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
  }
  if (parsed.data.bannerText !== undefined) updates.bannerText = parsed.data.bannerText;
  if (parsed.data.lifetimeSlots !== undefined) {
    updates.lifetimeSlots = parsed.data.lifetimeSlots;
  }
  if (parsed.data.maxRedemptions !== undefined) {
    updates.maxRedemptions = parsed.data.maxRedemptions;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No-op update" }, { status: 400 });
  }

  await db.update(promos).set(updates).where(eq(promos.id, id));
  return NextResponse.json({ ok: true });
}

// DELETE — only allowed if the promo has had no redemptions. Active
// promos with redemptionsUsed > 0 have to be deactivated (PATCH
// isActive=false) instead, so we keep the audit row.
export async function DELETE(_req: Request, { params }: Ctx) {
  const adminOrRes = await requireAdmin();
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const { id } = await params;
  const [row] = await db.select().from(promos).where(eq(promos.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (row.redemptionsUsed > 0 || row.lifetimeSlotsUsed > 0) {
    return NextResponse.json(
      {
        error:
          "Promo has redemptions; deactivate (set isActive=false) instead of deleting.",
      },
      { status: 409 },
    );
  }

  await db.delete(promos).where(eq(promos.id, id));
  return NextResponse.json({ ok: true });
}
