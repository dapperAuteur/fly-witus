import { NextResponse } from "next/server";
import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { groupMembers, groups } from "@/db/schema/groups";
import { groupMeetups } from "@/db/schema/meetups";
import { env, hasCron } from "@/lib/env";
import { sendEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Daily reminder for scheduled meetups happening within the next ~26h.
// The window is slightly over 24h so a once-daily cron (Hobby plan caps
// crons at 24h intervals) never misses an event. reminderSentAt guards
// against double-sending across runs.
const WINDOW_HOURS = 26;

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  if (!hasCron) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

  const due = await db
    .select({
      meetup: groupMeetups,
      groupName: groups.name,
    })
    .from(groupMeetups)
    .innerJoin(groups, eq(groups.id, groupMeetups.groupId))
    .where(
      and(
        eq(groupMeetups.status, "scheduled"),
        isNull(groupMeetups.reminderSentAt),
        gt(groupMeetups.finalizedStart, now),
        lte(groupMeetups.finalizedStart, windowEnd),
      ),
    );

  if (due.length === 0) {
    return NextResponse.json({ ok: true, reminded: 0 });
  }

  let reminded = 0;
  for (const { meetup, groupName } of due) {
    try {
      const members = await db
        .select({ email: users.email })
        .from(groupMembers)
        .innerJoin(users, eq(users.id, groupMembers.userId))
        .where(eq(groupMembers.groupId, meetup.groupId));

      const when = meetup.finalizedStart
        ? meetup.finalizedStart.toLocaleString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })
        : "soon";

      await Promise.allSettled(
        members.map((m) =>
          sendEmail({
            to: m.email,
            subject: `Reminder: "${meetup.title}" meetup is coming up`,
            text: [
              `Your ${groupName} group meetup is coming up.`,
              ``,
              `What:  ${meetup.title}`,
              `When:  ${when}`,
              meetup.locationName ? `Where: ${meetup.locationName}` : null,
              ``,
              `See the group: ${env.BETTER_AUTH_URL}/groups/${meetup.groupId}`,
            ]
              .filter(Boolean)
              .join("\n"),
          }),
        ),
      );

      await db
        .update(groupMeetups)
        .set({ reminderSentAt: new Date() })
        .where(eq(groupMeetups.id, meetup.id));
      reminded++;
    } catch (err) {
      // One meetup failing shouldn't abort the rest; leave its
      // reminderSentAt null so the next run retries it.
      console.error(`[cron/meetup-reminders] meetup ${meetup.id} failed:`, err);
    }
  }

  return NextResponse.json({ ok: true, reminded });
}
