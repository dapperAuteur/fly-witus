import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { requireAdmin } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

const tierEnum = z.enum(["free", "cloud_monthly", "cloud_annual", "lifetime"]);

const updateSchema = z.object({
  accountTier: tierEnum.optional(),
  isAdmin: z.boolean().optional(),
  // Admin can manually clear/extend a paid window. Null clears.
  tierExpiresAt: z.string().datetime().nullable().optional(),
});

// PATCH /api/admin/users/[id] — admin-only tier/role mutation. Used by
// the /admin/users page and (in the next branch) /admin/cashapp activation.
export async function PATCH(req: Request, { params }: Ctx) {
  const adminOrRes = await requireAdmin();
  if (adminOrRes instanceof NextResponse) return adminOrRes;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Self-demotion guard: an admin can't clear their own isAdmin flag in
  // a single request. Prevents accidental lockout of the only admin
  // (BAM is the only admin at launch). Removing isAdmin from another
  // admin is allowed.
  if (parsed.data.isAdmin === false && adminOrRes.id === id) {
    return NextResponse.json(
      { error: "Cannot remove your own admin flag from this UI" },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.accountTier !== undefined) updates.accountTier = parsed.data.accountTier;
  if (parsed.data.isAdmin !== undefined) updates.isAdmin = parsed.data.isAdmin;
  if (parsed.data.tierExpiresAt !== undefined) {
    updates.tierExpiresAt = parsed.data.tierExpiresAt
      ? new Date(parsed.data.tierExpiresAt)
      : null;
  }

  await db.update(users).set(updates).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
