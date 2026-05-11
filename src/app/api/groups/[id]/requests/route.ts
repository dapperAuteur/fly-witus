import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { groupFlightRequests } from "@/db/schema/groups";
import { flightRequestCreateSchema } from "@/lib/groups-api";
import { getMembership } from "@/lib/groups-queries";
import { requireUser } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/groups/[id]/requests — list all flight requests for the group,
// newest-first. Membership required (404 to avoid existence leak).
//
// Two queries: requests joined to requester (always present), then a
// batch lookup for claimant display names. Self-joining users twice
// in drizzle requires aliases; the two-query split is simpler and the
// requester join carries most of the response payload.
export async function GET(_req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select({
      request: groupFlightRequests,
      requesterEmail: users.email,
      requesterName: users.displayName,
    })
    .from(groupFlightRequests)
    .innerJoin(users, eq(users.id, groupFlightRequests.requestedById))
    .where(eq(groupFlightRequests.groupId, groupId))
    .orderBy(desc(groupFlightRequests.createdAt));

  const claimantIds = Array.from(
    new Set(rows.map((r) => r.request.claimedById).filter((v): v is string => !!v)),
  );
  const claimantMap = new Map<string, { email: string; displayName: string | null }>();
  if (claimantIds.length > 0) {
    const claimants = await db
      .select({ id: users.id, email: users.email, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, claimantIds));
    for (const c of claimants) claimantMap.set(c.id, c);
  }

  const enriched = rows.map((r) => {
    const claimant = r.request.claimedById ? claimantMap.get(r.request.claimedById) : null;
    return {
      ...r.request,
      requesterName: r.requesterName ?? r.requesterEmail,
      claimantName: claimant?.displayName ?? claimant?.email ?? null,
    };
  });

  return NextResponse.json({ requests: enriched });
}

// POST /api/groups/[id]/requests — create a flight request. Any group
// member can post.
export async function POST(req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = flightRequestCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // If assignedToId is set, verify they're a member of this group.
  if (input.assignedToId) {
    const assignedMembership = await getMembership(groupId, input.assignedToId);
    if (!assignedMembership) {
      return NextResponse.json(
        { error: "Assigned user is not a member of this group" },
        { status: 400 },
      );
    }
  }

  const id = nanoid();
  await db.insert(groupFlightRequests).values({
    id,
    groupId,
    requestedById: userOrRes.id,
    assignedToId: input.assignedToId ?? null,
    title: input.title,
    description: input.description,
    missionType: input.missionType,
    location: input.location ?? null,
    targetDate: input.targetDate ? new Date(input.targetDate) : null,
    priority: input.priority,
    bvcEpisode: input.bvcEpisode ?? null,
    wanderlearnCourseSlug: input.wanderlearnCourseSlug ?? null,
    partnerInstitution: input.partnerInstitution ?? null,
    academicPurpose: input.academicPurpose ?? null,
  });

  return NextResponse.json({ id }, { status: 201 });
}
