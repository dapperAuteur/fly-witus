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

// v3 §3 flight-request lifecycle. Transitions:
//   open → claimed (any member claims)
//   claimed → in_progress (claimant explicitly starts)
//   claimed/in_progress → completed (claimant links a mission)
//   any non-completed → cancelled (requester cancels)
export const flightRequestStatus = pgEnum("flight_request_status", [
  "open",
  "claimed",
  "in_progress",
  "completed",
  "cancelled",
]);

export const flightRequestPriority = pgEnum("flight_request_priority", [
  "low",
  "medium",
  "high",
]);

export const groupFlightRequests = pgTable(
  "group_flight_requests",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    requestedById: text("requested_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Optional pre-assignment to a specific group member. Open if null.
    assignedToId: text("assigned_to_id").references(() => users.id, {
      onDelete: "set null",
    }),

    title: text("title").notNull(),
    description: text("description").notNull(),
    // Free-text on purpose — 'recreational' | 'bvc_primary_source' | etc.
    // Mirrors mission_type values; not enum-typed because future mission
    // types shouldn't require a flight-requests migration.
    missionType: text("mission_type").notNull(),
    location: text("location"),
    targetDate: timestamp("target_date", { withTimezone: true, mode: "date" }),
    priority: flightRequestPriority("priority").notNull().default("medium"),

    status: flightRequestStatus("status").notNull().default("open"),
    claimedById: text("claimed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    completedMissionId: text("completed_mission_id").references(() => missions.id, {
      onDelete: "set null",
    }),

    // BVC-specific fields — only populated for missionType = 'bvc_primary_source'.
    bvcEpisode: text("bvc_episode"),
    wanderlearnCourseSlug: text("wanderlearn_course_slug"),
    partnerInstitution: text("partner_institution"),
    academicPurpose: text("academic_purpose"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("group_flight_requests_group_idx").on(t.groupId, t.status, t.createdAt),
    index("group_flight_requests_claimed_idx").on(t.claimedById),
  ],
);

export const groupFlightRequestComments = pgTable(
  "group_flight_request_comments",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => groupFlightRequests.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("group_flight_request_comments_req_idx").on(t.requestId, t.createdAt)],
);

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;
export type GroupSharedMission = typeof groupSharedMissions.$inferSelect;
export type NewGroupSharedMission = typeof groupSharedMissions.$inferInsert;
export type GroupFlightRequest = typeof groupFlightRequests.$inferSelect;
export type NewGroupFlightRequest = typeof groupFlightRequests.$inferInsert;
export type GroupFlightRequestComment = typeof groupFlightRequestComments.$inferSelect;
export type NewGroupFlightRequestComment = typeof groupFlightRequestComments.$inferInsert;
