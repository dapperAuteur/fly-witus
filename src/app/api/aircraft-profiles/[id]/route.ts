import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { aircraftProfiles } from "@/db/schema/aircraft-profiles";
import { missions } from "@/db/schema/missions";
import { requireUser } from "@/lib/api-auth";
import { aircraftProfileUpdateSchema } from "@/lib/aircraft-profiles-api";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Params) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id } = await ctx.params;
  const [profile] = await db
    .select()
    .from(aircraftProfiles)
    .where(
      and(eq(aircraftProfiles.id, id), eq(aircraftProfiles.userId, userOrRes.id)),
    )
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ profile });
}

export async function PATCH(req: Request, ctx: Params) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = aircraftProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid aircraft profile payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Build the update set carefully so undefined fields don't overwrite
  // stored values. null is intentional ("clear this field").
  const updates: Partial<typeof aircraftProfiles.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) updates.name = input.name;
  if (input.model !== undefined) updates.model = input.model ?? null;
  if (input.weightGrams !== undefined) updates.weightGrams = input.weightGrams ?? null;
  if (input.regNumber !== undefined) updates.regNumber = input.regNumber ?? null;
  if (input.notes !== undefined) updates.notes = input.notes ?? null;

  const [updated] = await db
    .update(aircraftProfiles)
    .set(updates)
    .where(
      and(eq(aircraftProfiles.id, id), eq(aircraftProfiles.userId, userOrRes.id)),
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ profile: updated });
}

export async function DELETE(_req: Request, ctx: Params) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id } = await ctx.params;

  // Don't orphan-delete flight history. Set missions.profileId to null
  // for any missions that referenced this profile, then delete the
  // profile row. Both ops in one transaction so a partial failure
  // can't leave dangling references.
  const result = await db.transaction(async (tx) => {
    await tx
      .update(missions)
      .set({ profileId: null, updatedAt: new Date() })
      .where(and(eq(missions.profileId, id), eq(missions.userId, userOrRes.id)));

    const deleted = await tx
      .delete(aircraftProfiles)
      .where(
        and(
          eq(aircraftProfiles.id, id),
          eq(aircraftProfiles.userId, userOrRes.id),
        ),
      )
      .returning({ id: aircraftProfiles.id });

    return deleted;
  });

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
