import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groupSharedMissions } from "@/db/schema/groups";
import { getMembership } from "@/lib/groups-queries";
import { requireUser } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string; missionId: string }> };

// DELETE /api/groups/[id]/shared-missions/[missionId] — unshare. Only the
// member who originally shared it OR the group owner can unshare.
export async function DELETE(_req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId, missionId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [share] = await db
    .select()
    .from(groupSharedMissions)
    .where(
      and(
        eq(groupSharedMissions.groupId, groupId),
        eq(groupSharedMissions.missionId, missionId),
      ),
    )
    .limit(1);

  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = share.sharedById === userOrRes.id || membership.role === "owner";
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(groupSharedMissions).where(eq(groupSharedMissions.id, share.id));
  return NextResponse.json({ ok: true });
}
