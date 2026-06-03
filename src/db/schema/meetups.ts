import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { groups } from "./groups";

// Group flight meetups (Doodle-style scheduling). A group can have MANY
// meetups at once — there is intentionally NO uniqueness limiting a group
// to one active meetup. Flow: create (proposing) → members add time
// options + mark availability → organizer finalizes a time (scheduled) →
// email reminder fires → completed/cancelled.

export const groupMeetups = pgTable(
  "group_meetups",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    // Organizer. set null (not cascade) so a meetup survives the creator
    // deleting their account — it's a group event, not personal data.
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),

    title: text("title").notNull(),
    description: text("description"),
    // Free-text location for v1 (coords/map can be added later).
    locationName: text("location_name"),

    // proposing | scheduled | completed | cancelled
    status: text("status").notNull().default("proposing"),

    // Set when the organizer locks in a time.
    finalizedStart: timestamp("finalized_start", { withTimezone: true }),
    finalizedEnd: timestamp("finalized_end", { withTimezone: true }),

    // Guards the reminder cron against double-sending.
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("group_meetups_group_idx").on(table.groupId, table.createdAt),
    // Cron scan: scheduled meetups starting soon that haven't been reminded.
    index("group_meetups_reminder_idx").on(table.status, table.finalizedStart),
  ],
);

// Candidate time slots. Any member can propose options ("times I'm
// available"), not just the organizer.
export const meetupTimeOptions = pgTable(
  "meetup_time_options",
  {
    id: text("id").primaryKey(),
    meetupId: text("meetup_id")
      .notNull()
      .references(() => groupMeetups.id, { onDelete: "cascade" }),
    proposedById: text("proposed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("meetup_time_options_meetup_idx").on(table.meetupId)],
);

// Per-member availability on a time option: yes | no | maybe. One row per
// (option, user).
export const meetupResponses = pgTable(
  "meetup_responses",
  {
    id: text("id").primaryKey(),
    optionId: text("option_id")
      .notNull()
      .references(() => meetupTimeOptions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    response: text("response").notNull(), // yes | no | maybe
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("meetup_responses_option_user_unique").on(
      table.optionId,
      table.userId,
    ),
  ],
);

export type GroupMeetup = typeof groupMeetups.$inferSelect;
export type MeetupTimeOption = typeof meetupTimeOptions.$inferSelect;
export type MeetupResponse = typeof meetupResponses.$inferSelect;
