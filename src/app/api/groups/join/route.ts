import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { groupMembers, groups } from "@/db/schema/groups";
import { joinGroupSchema } from "@/lib/groups-api";
import { requirePaidUser } from "@/lib/tier";

// POST /api/groups/join — accept an invite code. Paid users only (v3 §3
// gates the entire group surface). Idempotent: re-joining returns the
// existing membership.
export async function POST(req: Request) {
  const userOrRes = await requirePaidUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = joinGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid invite code", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const code = parsed.data.inviteCode.trim().toUpperCase();
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.inviteCode, code))
    .limit(1);

  if (!group) {
    return NextResponse.json({ error: "Invite code not found" }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userOrRes.id)))
    .limit(1);

  if (existing) {
    return NextResponse.json({ groupId: group.id, alreadyMember: true });
  }

  await db.insert(groupMembers).values({
    id: nanoid(),
    groupId: group.id,
    userId: userOrRes.id,
    role: "member",
    invitedBy: group.ownerId,
  });

  return NextResponse.json({ groupId: group.id, alreadyMember: false }, { status: 201 });
}
