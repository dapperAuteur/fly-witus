import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groupMeetups, meetupTimeOptions } from "@/db/schema/meetups";
import { requireUser } from "@/lib/api-auth";
import { getMembership } from "@/lib/groups-queries";

type Ctx = {
  params: Promise<{ id: string; meetupId: string; optionId: string }>;
};

// DELETE a proposed time option. Allowed for whoever proposed it, or a
// group owner/admin. Responses on it cascade away.
export async function DELETE(_req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId, meetupId, optionId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [row] = await db
    .select({
      proposedById: meetupTimeOptions.proposedById,
      meetupGroupId: groupMeetups.groupId,
    })
    .from(meetupTimeOptions)
    .innerJoin(groupMeetups, eq(groupMeetups.id, meetupTimeOptions.meetupId))
    .where(
      and(
        eq(meetupTimeOptions.id, optionId),
        eq(meetupTimeOptions.meetupId, meetupId),
      ),
    )
    .limit(1);

  if (!row || row.meetupGroupId !== groupId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isManager = membership.role === "owner" || membership.role === "admin";
  if (row.proposedById !== userOrRes.id && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await db.delete(meetupTimeOptions).where(eq(meetupTimeOptions.id, optionId));
  } catch (err) {
    console.error("[DELETE …/options/[optionId]]", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
