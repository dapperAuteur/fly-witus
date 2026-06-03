import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { groupMeetups, meetupTimeOptions } from "@/db/schema/meetups";
import { requireUser } from "@/lib/api-auth";
import { getMembership } from "@/lib/groups-queries";
import { listGroupMeetups } from "@/lib/meetups-queries";
import { meetupCreateSchema } from "@/lib/meetups-api";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/groups/[id]/meetups — list the group's meetups (membership
// required; 404 to avoid leaking group existence).
export async function GET(_req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const meetups = await listGroupMeetups(groupId);
    return NextResponse.json({ meetups });
  } catch (err) {
    console.error("[GET /api/groups/[id]/meetups]", err);
    return NextResponse.json({ error: "Failed to load meetups" }, { status: 500 });
  }
}

// POST /api/groups/[id]/meetups — any member can create a meetup, with
// optional initial time options.
export async function POST(req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = meetupCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid meetup", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const meetupId = nanoid();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(groupMeetups).values({
        id: meetupId,
        groupId,
        createdById: userOrRes.id,
        title: input.title,
        description: input.description ?? null,
        locationName: input.locationName ?? null,
      });
      if (input.timeOptions?.length) {
        await tx.insert(meetupTimeOptions).values(
          input.timeOptions.map((o) => ({
            id: nanoid(),
            meetupId,
            proposedById: userOrRes.id,
            startsAt: new Date(o.startsAt),
            endsAt: o.endsAt ? new Date(o.endsAt) : null,
          })),
        );
      }
    });
  } catch (err) {
    console.error("[POST /api/groups/[id]/meetups]", err);
    return NextResponse.json({ error: "Failed to create meetup" }, { status: 500 });
  }

  return NextResponse.json({ id: meetupId }, { status: 201 });
}
