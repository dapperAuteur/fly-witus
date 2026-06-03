import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groupMeetups, meetupTimeOptions } from "@/db/schema/meetups";
import { requireUser } from "@/lib/api-auth";
import { getMembership } from "@/lib/groups-queries";
import { getMeetupDetail } from "@/lib/meetups-queries";
import { meetupUpdateSchema } from "@/lib/meetups-api";

type Ctx = { params: Promise<{ id: string; meetupId: string }> };

// Manage = the meetup's creator, or a group owner/admin.
function canManage(
  role: string,
  createdById: string | null,
  userId: string,
): boolean {
  return role === "owner" || role === "admin" || createdById === userId;
}

// GET /api/groups/[id]/meetups/[meetupId] — full detail (membership req).
export async function GET(_req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId, meetupId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const detail = await getMeetupDetail(meetupId);
    if (!detail || detail.groupId !== groupId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ meetup: detail, currentUserId: userOrRes.id });
  } catch (err) {
    console.error("[GET /api/groups/[id]/meetups/[meetupId]]", err);
    return NextResponse.json({ error: "Failed to load meetup" }, { status: 500 });
  }
}

// PATCH — edit fields and/or run a lifecycle action. Creator or owner/admin.
export async function PATCH(req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId, meetupId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [meetup] = await db
    .select()
    .from(groupMeetups)
    .where(and(eq(groupMeetups.id, meetupId), eq(groupMeetups.groupId, groupId)))
    .limit(1);
  if (!meetup) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canManage(membership.role, meetup.createdById, userOrRes.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = meetupUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const updates: Partial<typeof groupMeetups.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.locationName !== undefined) updates.locationName = input.locationName;

  try {
    if (input.action === "finalize") {
      if (!input.finalOptionId) {
        return NextResponse.json(
          { error: "Pick a time option to finalize." },
          { status: 400 },
        );
      }
      const [option] = await db
        .select()
        .from(meetupTimeOptions)
        .where(
          and(
            eq(meetupTimeOptions.id, input.finalOptionId),
            eq(meetupTimeOptions.meetupId, meetupId),
          ),
        )
        .limit(1);
      if (!option) {
        return NextResponse.json({ error: "Unknown time option" }, { status: 400 });
      }
      updates.status = "scheduled";
      updates.finalizedStart = option.startsAt;
      updates.finalizedEnd = option.endsAt;
      // Re-finalizing should re-arm the reminder.
      updates.reminderSentAt = null;
    } else if (input.action === "cancel") {
      updates.status = "cancelled";
    } else if (input.action === "complete") {
      updates.status = "completed";
    } else if (input.action === "reopen") {
      updates.status = "proposing";
      updates.finalizedStart = null;
      updates.finalizedEnd = null;
    }

    await db.update(groupMeetups).set(updates).where(eq(groupMeetups.id, meetupId));
  } catch (err) {
    console.error("[PATCH /api/groups/[id]/meetups/[meetupId]]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — creator or owner/admin. Cascades options + responses.
export async function DELETE(_req: Request, { params }: Ctx) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id: groupId, meetupId } = await params;
  const membership = await getMembership(groupId, userOrRes.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [meetup] = await db
    .select({ createdById: groupMeetups.createdById })
    .from(groupMeetups)
    .where(and(eq(groupMeetups.id, meetupId), eq(groupMeetups.groupId, groupId)))
    .limit(1);
  if (!meetup) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canManage(membership.role, meetup.createdById, userOrRes.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await db.delete(groupMeetups).where(eq(groupMeetups.id, meetupId));
  } catch (err) {
    console.error("[DELETE /api/groups/[id]/meetups/[meetupId]]", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
