import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { groupMeetups, meetupTimeOptions } from "@/db/schema/meetups";
import { requireUser } from "@/lib/api-auth";
import { getMembership } from "@/lib/groups-queries";
import { addTimeOptionSchema } from "@/lib/meetups-api";

type Ctx = { params: Promise<{ id: string; meetupId: string }> };

// POST /api/groups/[id]/meetups/[meetupId]/options — any member can
// propose a candidate time ("a time I'm available").
export async function POST(req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId, meetupId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Confirm the meetup is in this group (and still open to proposals).
  const [meetup] = await db
    .select({ status: groupMeetups.status })
    .from(groupMeetups)
    .where(and(eq(groupMeetups.id, meetupId), eq(groupMeetups.groupId, groupId)))
    .limit(1);
  if (!meetup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (meetup.status === "cancelled" || meetup.status === "completed") {
    return NextResponse.json(
      { error: "This meetup is closed to new times." },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = addTimeOptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid time option", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const id = nanoid();
  try {
    await db.insert(meetupTimeOptions).values({
      id,
      meetupId,
      proposedById: userOrRes.id,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    });
  } catch (err) {
    console.error("[POST …/meetups/[meetupId]/options]", err);
    return NextResponse.json({ error: "Failed to add time" }, { status: 500 });
  }

  return NextResponse.json({ id }, { status: 201 });
}
