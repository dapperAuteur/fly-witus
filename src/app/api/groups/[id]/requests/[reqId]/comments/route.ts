import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import {
  groupFlightRequestComments,
  groupFlightRequests,
} from "@/db/schema/groups";
import { flightRequestCommentSchema } from "@/lib/groups-api";
import { getMembership } from "@/lib/groups-queries";
import { requireUser } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string; reqId: string }> };

// GET — list comments oldest-first.
export async function GET(_req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId, reqId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Confirm request belongs to this group (defense against URL forgery).
  const [request] = await db
    .select({ id: groupFlightRequests.id })
    .from(groupFlightRequests)
    .where(and(eq(groupFlightRequests.id, reqId), eq(groupFlightRequests.groupId, groupId)))
    .limit(1);
  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const comments = await db
    .select({
      id: groupFlightRequestComments.id,
      userId: groupFlightRequestComments.userId,
      content: groupFlightRequestComments.content,
      createdAt: groupFlightRequestComments.createdAt,
      authorEmail: users.email,
      authorName: users.displayName,
    })
    .from(groupFlightRequestComments)
    .innerJoin(users, eq(users.id, groupFlightRequestComments.userId))
    .where(eq(groupFlightRequestComments.requestId, reqId))
    .orderBy(asc(groupFlightRequestComments.createdAt));

  return NextResponse.json({ comments });
}

// POST — add comment.
export async function POST(req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId, reqId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [request] = await db
    .select({ id: groupFlightRequests.id })
    .from(groupFlightRequests)
    .where(and(eq(groupFlightRequests.id, reqId), eq(groupFlightRequests.groupId, groupId)))
    .limit(1);
  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = flightRequestCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid comment", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const id = nanoid();
  await db.insert(groupFlightRequestComments).values({
    id,
    requestId: reqId,
    userId: userOrRes.id,
    content: parsed.data.content,
  });

  return NextResponse.json({ id }, { status: 201 });
}
