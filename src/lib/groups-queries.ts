// DB query helpers for groups. Centralized so route handlers stay tight
// and so membership/role checks can't drift between endpoints.

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import {
  groupMembers,
  groupSharedMissions,
  groups,
  type GroupMember,
} from "@/db/schema/groups";
import { flights, missionPhotos, missions } from "@/db/schema/missions";

export async function getMembership(
  groupId: string,
  userId: string,
): Promise<GroupMember | null> {
  const [row] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listUserGroups(userId: string) {
  // One round trip: join groups ↔ members for this user. No N+1.
  const rows = await db
    .select({
      group: groups,
      role: groupMembers.role,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId))
    .orderBy(desc(groups.createdAt));

  if (rows.length === 0) return [];

  const groupIds = rows.map((r) => r.group.id);

  // Counts are good-enough for the list view; the dashboard does its
  // own detailed fetch.
  const [memberRows, sharedRows] = await Promise.all([
    db
      .select({ groupId: groupMembers.groupId, count: groupMembers.id })
      .from(groupMembers)
      .where(inArray(groupMembers.groupId, groupIds)),
    db
      .select({ groupId: groupSharedMissions.groupId, count: groupSharedMissions.id })
      .from(groupSharedMissions)
      .where(inArray(groupSharedMissions.groupId, groupIds)),
  ]);

  const memberCount = countBy(memberRows, (r) => r.groupId);
  const sharedCount = countBy(sharedRows, (r) => r.groupId);

  return rows.map((r) => ({
    ...r.group,
    role: r.role,
    memberCount: memberCount.get(r.group.id) ?? 0,
    sharedMissionCount: sharedCount.get(r.group.id) ?? 0,
  }));
}

export async function listGroupMembers(groupId: string) {
  return db
    .select({
      id: groupMembers.id,
      userId: groupMembers.userId,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
      invitedBy: groupMembers.invitedBy,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(desc(groupMembers.joinedAt));
}

export async function listGroupSharedMissions(groupId: string) {
  // Fetch share rows + their missions in two queries (not N+1). Then
  // batch-load flights and photos for those missions.
  const shares = await db
    .select({
      share: groupSharedMissions,
      mission: missions,
      sharedByEmail: users.email,
      sharedByName: users.displayName,
    })
    .from(groupSharedMissions)
    .innerJoin(missions, eq(missions.id, groupSharedMissions.missionId))
    .innerJoin(users, eq(users.id, groupSharedMissions.sharedById))
    .where(eq(groupSharedMissions.groupId, groupId))
    .orderBy(desc(groupSharedMissions.sharedAt));

  if (shares.length === 0) return [];

  const missionIds = shares.map((s) => s.mission.id);
  const [allFlights, allPhotos] = await Promise.all([
    db.select().from(flights).where(inArray(flights.missionId, missionIds)),
    db.select().from(missionPhotos).where(inArray(missionPhotos.missionId, missionIds)),
  ]);

  const flightsByMission = groupBy(allFlights, (f) => f.missionId);
  const photosByMission = groupBy(allPhotos, (p) => p.missionId);

  return shares.map((s) => ({
    shareId: s.share.id,
    sharedAt: s.share.sharedAt,
    sharedById: s.share.sharedById,
    sharedByName: s.sharedByName ?? s.sharedByEmail,
    note: s.share.note,
    mission: {
      ...s.mission,
      flights: (flightsByMission.get(s.mission.id) ?? []).sort(
        (a, b) => a.flightNumber - b.flightNumber,
      ),
      photos: photosByMission.get(s.mission.id) ?? [],
    },
  }));
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function countBy<T, K>(items: T[], key: (item: T) => K): Map<K, number> {
  const map = new Map<K, number>();
  for (const item of items) {
    const k = key(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}
