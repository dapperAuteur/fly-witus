// DB query helpers for group meetups. Centralized so route handlers stay
// tight and the detail-payload shape is defined once.

import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import {
  groupMeetups,
  meetupResponses,
  meetupTimeOptions,
} from "@/db/schema/meetups";

// List meetups for a group with light aggregates for the tab view.
export async function listGroupMeetups(groupId: string) {
  const rows = await db
    .select({
      meetup: groupMeetups,
      creatorName: users.displayName,
      creatorEmail: users.email,
    })
    .from(groupMeetups)
    .leftJoin(users, eq(users.id, groupMeetups.createdById))
    .where(eq(groupMeetups.groupId, groupId))
    .orderBy(desc(groupMeetups.createdAt));

  if (rows.length === 0) return [];

  const meetupIds = rows.map((r) => r.meetup.id);
  const options = await db
    .select({ id: meetupTimeOptions.id, meetupId: meetupTimeOptions.meetupId })
    .from(meetupTimeOptions)
    .where(inArray(meetupTimeOptions.meetupId, meetupIds));

  const optionCount = new Map<string, number>();
  for (const o of options) {
    optionCount.set(o.meetupId, (optionCount.get(o.meetupId) ?? 0) + 1);
  }

  return rows.map((r) => ({
    ...r.meetup,
    createdByName: r.creatorName ?? r.creatorEmail ?? "Former member",
    optionCount: optionCount.get(r.meetup.id) ?? 0,
  }));
}

// Full detail for one meetup: the meetup, its time options (with proposer
// names), and every response (with responder names) so the client can
// render the availability grid.
export async function getMeetupDetail(meetupId: string) {
  const [meetupRow] = await db
    .select({
      meetup: groupMeetups,
      creatorName: users.displayName,
      creatorEmail: users.email,
    })
    .from(groupMeetups)
    .leftJoin(users, eq(users.id, groupMeetups.createdById))
    .where(eq(groupMeetups.id, meetupId))
    .limit(1);

  if (!meetupRow) return null;

  const options = await db
    .select({
      option: meetupTimeOptions,
      proposerName: users.displayName,
      proposerEmail: users.email,
    })
    .from(meetupTimeOptions)
    .leftJoin(users, eq(users.id, meetupTimeOptions.proposedById))
    .where(eq(meetupTimeOptions.meetupId, meetupId))
    .orderBy(asc(meetupTimeOptions.startsAt));

  const optionIds = options.map((o) => o.option.id);
  const responses = optionIds.length
    ? await db
        .select({
          response: meetupResponses,
          name: users.displayName,
          email: users.email,
        })
        .from(meetupResponses)
        .innerJoin(users, eq(users.id, meetupResponses.userId))
        .where(inArray(meetupResponses.optionId, optionIds))
    : [];

  return {
    ...meetupRow.meetup,
    createdByName: meetupRow.creatorName ?? meetupRow.creatorEmail ?? "Former member",
    options: options.map((o) => ({
      ...o.option,
      proposedByName: o.proposerName ?? o.proposerEmail ?? "Former member",
    })),
    responses: responses.map((r) => ({
      id: r.response.id,
      optionId: r.response.optionId,
      userId: r.response.userId,
      response: r.response.response,
      userName: r.name ?? r.email,
    })),
  };
}

// Lightweight lookup for nested routes: which group does this meetup
// belong to? (Used to membership-check before mutating options/responses.)
export async function getMeetupGroupId(meetupId: string): Promise<string | null> {
  const [row] = await db
    .select({ groupId: groupMeetups.groupId })
    .from(groupMeetups)
    .where(eq(groupMeetups.id, meetupId))
    .limit(1);
  return row?.groupId ?? null;
}
