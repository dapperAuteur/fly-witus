import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { groupMembers, groups } from "@/db/schema/groups";
import { generateInviteCode, groupCreateSchema } from "@/lib/groups-api";
import { listUserGroups } from "@/lib/groups-queries";
import { requirePaidUser } from "@/lib/tier";

// GET /api/groups — list every group the current user is a member of.
// Free users get 403 (paid feature per v3 §3).
export async function GET() {
  const userOrRes = await requirePaidUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const list = await listUserGroups(userOrRes.id);
  return NextResponse.json({ groups: list });
}

// POST /api/groups — create a group; creator is auto-added as owner.
export async function POST(req: Request) {
  const userOrRes = await requirePaidUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = groupCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid group payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const groupId = nanoid();
  const inviteCode = generateInviteCode();

  await db.transaction(async (tx) => {
    await tx.insert(groups).values({
      id: groupId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      avatarUrl: parsed.data.avatarUrl ?? null,
      ownerId: userOrRes.id,
      inviteCode,
    });
    await tx.insert(groupMembers).values({
      id: nanoid(),
      groupId,
      userId: userOrRes.id,
      role: "owner",
      invitedBy: null,
    });
  });

  return NextResponse.json(
    { group: { id: groupId, inviteCode } },
    { status: 201 },
  );
}
