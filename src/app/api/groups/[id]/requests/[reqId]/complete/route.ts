import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import {
  groupFlightRequests,
  groupSharedMissions,
  groups,
} from "@/db/schema/groups";
import { missions } from "@/db/schema/missions";
import { flightRequestCompleteSchema } from "@/lib/groups-api";
import { getMembership } from "@/lib/groups-queries";
import { requireUser } from "@/lib/api-auth";
import { sendFlightRequestCompletedEmail } from "@/lib/mailer";

type Ctx = { params: Promise<{ id: string; reqId: string }> };

// POST /api/groups/[id]/requests/[reqId]/complete — claimant links a
// completed mission. Atomic in one transaction:
//   1. Verify the mission belongs to the claimant
//   2. Mark request completed + link mission
//   3. Auto-share that mission to the group (idempotent on dupe)
// Then fire requester email outside the transaction so a Mailgun outage
// doesn't roll back the completion.
export async function POST(req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId, reqId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = flightRequestCompleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [request] = await db
    .select()
    .from(groupFlightRequests)
    .where(and(eq(groupFlightRequests.id, reqId), eq(groupFlightRequests.groupId, groupId)))
    .limit(1);
  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (request.claimedById !== userOrRes.id) {
    return NextResponse.json(
      { error: "Only the claimant can complete this request" },
      { status: 403 },
    );
  }
  if (request.status !== "claimed" && request.status !== "in_progress") {
    return NextResponse.json(
      { error: `Cannot complete from status '${request.status}'` },
      { status: 409 },
    );
  }

  // Mission must belong to the claimant.
  const [mission] = await db
    .select()
    .from(missions)
    .where(and(eq(missions.id, parsed.data.missionId), eq(missions.userId, userOrRes.id)))
    .limit(1);
  if (!mission) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(groupFlightRequests)
      .set({
        status: "completed",
        completedMissionId: mission.id,
        updatedAt: new Date(),
      })
      .where(eq(groupFlightRequests.id, reqId));

    // Auto-share. If already shared, swallow the unique-violation —
    // the mission is now associated either way.
    try {
      await tx.insert(groupSharedMissions).values({
        id: nanoid(),
        groupId,
        missionId: mission.id,
        sharedById: userOrRes.id,
        note: `Completed flight request: ${request.title}`,
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  });

  // Email requester (best-effort — completion already committed).
  try {
    const [requester] = await db
      .select({ email: users.email, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, request.requestedById))
      .limit(1);
    const [claimant] = await db
      .select({ email: users.email, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userOrRes.id))
      .limit(1);
    const [group] = await db
      .select({ name: groups.name })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    if (requester && claimant && group) {
      void sendFlightRequestCompletedEmail({
        to: requester.email,
        requesterName: requester.displayName ?? requester.email,
        claimantName: claimant.displayName ?? claimant.email,
        groupName: group.name,
        requestTitle: request.title,
        missionLocation: mission.location,
        missionDate: mission.timestamp,
        missionDurationLabel: null,
        groupId,
      }).catch((err) => {
        console.error("[flight-request-complete] email send failed", err);
      });
    }
  } catch (err) {
    console.error("[flight-request-complete] email lookup failed", err);
  }

  return NextResponse.json({ ok: true });
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const direct = (err as { code?: unknown }).code;
  if (direct === "23505") return true;
  const cause = (err as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") return false;
  return (cause as { code?: unknown }).code === "23505";
}
