import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { missions } from "./missions";

// v3 §3: 'owner' | 'admin' | 'member'. Owner is set on group create and
// can't be transferred in this branch (out of scope).
export const groupRole = pgEnum("group_role", ["owner", "admin", "member"]);

export const groups = pgTable(
  "groups",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    avatarUrl: text("avatar_url"),
    // 8-char alphanumeric, regenerable. Unique so /join/[code] resolves
    // to exactly one group.
    inviteCode: text("invite_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("groups_invite_code_unique").on(t.inviteCode)],
);

export const groupMembers = pgTable(
  "group_members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: groupRole("role").notNull().default("member"),
    invitedBy: text("invited_by"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("group_member_uniq").on(t.groupId, t.userId),
    index("group_members_user_idx").on(t.userId),
  ],
);

// One row per (group, mission) — sharing the same mission to multiple
// groups creates multiple rows. v3 §3 explicitly: sharing is opt-in per
// mission.
export const groupSharedMissions = pgTable(
  "group_shared_missions",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    sharedById: text("shared_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    note: text("note"),
    sharedAt: timestamp("shared_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("group_mission_uniq").on(t.groupId, t.missionId),
    index("group_shared_missions_group_idx").on(t.groupId, t.sharedAt),
  ],
);

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;
export type GroupSharedMission = typeof groupSharedMissions.$inferSelect;
export type NewGroupSharedMission = typeof groupSharedMissions.$inferInsert;
