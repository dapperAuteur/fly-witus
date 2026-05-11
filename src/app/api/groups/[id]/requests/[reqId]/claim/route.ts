import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groupFlightRequests } from "@/db/schema/groups";
import { getMembership } from "@/lib/groups-queries";
import { requireUser } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string; reqId: string }> };

// POST /api/groups/[id]/requests/[reqId]/claim — any member can claim an
// open request. If assignedToId is set, only that user can claim.
export async function POST(_req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId, reqId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [request] = await db
    .select()
    .from(groupFlightRequests)
    .where(and(eq(groupFlightRequests.id, reqId), eq(groupFlightRequests.groupId, groupId)))
    .limit(1);
  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (request.status !== "open") {
    return NextResponse.json(
      { error: `Request is ${request.status}, can't claim` },
      { status: 409 },
    );
  }
  if (request.assignedToId && request.assignedToId !== userOrRes.id) {
    return NextResponse.json(
      { error: "Request is assigned to a specific member" },
      { status: 403 },
    );
  }

  await db
    .update(groupFlightRequests)
    .set({
      status: "claimed",
      claimedById: userOrRes.id,
      claimedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(groupFlightRequests.id, reqId));

  return NextResponse.json({ ok: true });
}
