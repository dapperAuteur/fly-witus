import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groupMeetups } from "@/db/schema/meetups";
import { requireUser } from "@/lib/api-auth";
import { getMembership } from "@/lib/groups-queries";

type Ctx = { params: Promise<{ id: string; meetupId: string }> };

// Format a Date as an iCalendar UTC timestamp: YYYYMMDDTHHMMSSZ.
function ics(dt: Date): string {
  return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Escape per RFC 5545 (commas, semicolons, backslashes, newlines).
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// GET /api/groups/[id]/meetups/[meetupId]/ics — downloadable calendar
// event for a SCHEDULED meetup. Add-to-calendar works in Apple/Google/
// Outlook. Membership required.
export async function GET(_req: Request, { params }: Ctx) {
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

  if (!meetup.finalizedStart) {
    return NextResponse.json(
      { error: "This meetup doesn't have a confirmed time yet." },
      { status: 409 },
    );
  }

  const start = meetup.finalizedStart;
  // Default to a 1-hour block when no end was set.
  const end = meetup.finalizedEnd ?? new Date(start.getTime() + 60 * 60 * 1000);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fly WitUS//Group Meetups//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:meetup-${meetup.id}@fly.witus.online`,
    `DTSTAMP:${ics(new Date())}`,
    `DTSTART:${ics(start)}`,
    `DTEND:${ics(end)}`,
    `SUMMARY:${esc(meetup.title)}`,
    meetup.description ? `DESCRIPTION:${esc(meetup.description)}` : null,
    meetup.locationName ? `LOCATION:${esc(meetup.locationName)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return new NextResponse(lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="meetup-${meetup.id}.ics"`,
    },
  });
}
