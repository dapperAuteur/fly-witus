import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groups } from "@/db/schema/groups";
import { groupUpdateSchema } from "@/lib/groups-api";
import {
  getMembership,
  listGroupMembers,
  listGroupSharedMissions,
} from "@/lib/groups-queries";
import { requireUser } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/groups/[id] — group dashboard payload: group row + members +
// shared-missions feed. Membership required; otherwise 404 to avoid
// leaking group existence to non-members.
export async function GET(_req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id } = await params;
  try {
    const membership = await getMembership(id, userOrRes.id);
    if (!membership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [members, sharedMissions] = await Promise.all([
      listGroupMembers(id),
      listGroupSharedMissions(id),
    ]);

    return NextResponse.json({
      group,
      membership,
      members,
      sharedMissions,
    });
  } catch (err) {
    console.error("[GET /api/groups/[id]]", err);
    return NextResponse.json(
      { error: "Failed to load group" },
      { status: 500 },
    );
  }
}

// PATCH /api/groups/[id] — owner only. Edit name / description / avatar.
export async function PATCH(req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id } = await params;
  const membership = await getMembership(id, userOrRes.id);
  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = groupUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;

  await db.update(groups).set(updates).where(eq(groups.id, id));
  return NextResponse.json({ ok: true });
}

// DELETE /api/groups/[id] — owner only. Cascades to members + shared
// missions via FK on delete.
export async function DELETE(_req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id } = await params;
  const membership = await getMembership(id, userOrRes.id);
  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(groups).where(eq(groups.id, id));
  return NextResponse.json({ ok: true });
}
