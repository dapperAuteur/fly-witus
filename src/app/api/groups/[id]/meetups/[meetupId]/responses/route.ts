import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import {
  groupMeetups,
  meetupResponses,
  meetupTimeOptions,
} from "@/db/schema/meetups";
import { requireUser } from "@/lib/api-auth";
import { getMembership } from "@/lib/groups-queries";
import { meetupResponseSchema } from "@/lib/meetups-api";

type Ctx = { params: Promise<{ id: string; meetupId: string }> };

// PUT /api/groups/[id]/meetups/[meetupId]/responses — upsert the current
// user's availability (yes/no/maybe) for one time option. Any member.
export async function PUT(req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId, meetupId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = meetupResponseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid response", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Verify the option belongs to this meetup, and the meetup to this group.
  const [option] = await db
    .select({ id: meetupTimeOptions.id })
    .from(meetupTimeOptions)
    .innerJoin(groupMeetups, eq(groupMeetups.id, meetupTimeOptions.meetupId))
    .where(
      and(
        eq(meetupTimeOptions.id, parsed.data.optionId),
        eq(meetupTimeOptions.meetupId, meetupId),
        eq(groupMeetups.groupId, groupId),
      ),
    )
    .limit(1);
  if (!option) return NextResponse.json({ error: "Unknown time option" }, { status: 404 });

  try {
    await db
      .insert(meetupResponses)
      .values({
        id: nanoid(),
        optionId: parsed.data.optionId,
        userId: userOrRes.id,
        response: parsed.data.response,
      })
      .onConflictDoUpdate({
        target: [meetupResponses.optionId, meetupResponses.userId],
        set: { response: parsed.data.response, updatedAt: new Date() },
      });
  } catch (err) {
    console.error("[PUT …/meetups/[meetupId]/responses]", err);
    return NextResponse.json({ error: "Couldn't save your availability" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
