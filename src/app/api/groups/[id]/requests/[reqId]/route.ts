import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groupFlightRequests } from "@/db/schema/groups";
import { getMembership } from "@/lib/groups-queries";
import { requireUser } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string; reqId: string }> };

// PATCH /api/groups/[id]/requests/[reqId] — currently used only for
// cancellation by the requester (status → 'cancelled'). Edit-after-create
// is out of scope for v1 to keep the audit trail simple.
export async function PATCH(req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId, reqId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action;

  const [request] = await db
    .select()
    .from(groupFlightRequests)
    .where(and(eq(groupFlightRequests.id, reqId), eq(groupFlightRequests.groupId, groupId)))
    .limit(1);
  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "cancel") {
    const allowed =
      request.requestedById === userOrRes.id || membership.role === "owner";
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (request.status === "completed") {
      return NextResponse.json(
        { error: "Cannot cancel a completed request" },
        { status: 409 },
      );
    }
    await db
      .update(groupFlightRequests)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(groupFlightRequests.id, reqId));
    return NextResponse.json({ ok: true });
  }

  if (action === "start") {
    if (request.claimedById !== userOrRes.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (request.status !== "claimed") {
      return NextResponse.json(
        { error: `Cannot start from status '${request.status}'` },
        { status: 409 },
      );
    }
    await db
      .update(groupFlightRequests)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(groupFlightRequests.id, reqId));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
