import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// Per-user aircraft inventory. One pilot can fly multiple aircraft and
// pre-fill the mission form from a saved profile (saves repeated typing
// of model + reg number on every flight). Missions reference this table
// via missions.profileId; that FK was added to missions.ts as a forward
// declaration before this table existed — the comment there says "refs
// aircraft_profiles when that table lands."
//
// On profile delete, we set missions.profileId = null at the application
// layer (the route handler) rather than ON DELETE SET NULL because
// missions.profileId is a plain text column, not a real FK.
// plans/08 Phase 2a: the seam that makes the pilot module a MODULE rather than
// a second app. One inventory, one account, one set of missions — the UI
// branches on this column instead of the product forking in two.
//
// Every pre-existing row is 'uas'. That is not just a convenient default: the
// product shipped as a Part 107 tool, so every profile created before this
// column existed is definitionally a drone.
export const aircraftPlatform = pgEnum("aircraft_platform", ["uas", "manned"]);

export const aircraftProfiles = pgTable(
  "aircraft_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    model: text("model"),
    // Weight in grams. Integer, nullable. Form takes "350g" / "1.2kg" /
    // free-form input client-side; the page normalizes to grams before POST.
    weightGrams: integer("weight_grams"),
    regNumber: text("reg_number"),
    notes: text("notes"),

    platform: aircraftPlatform("platform").notNull().default("uas"),

    // Category and class as the pilot describes it — "asel", "helicopter",
    // "multirotor". Free text rather than an enum because the taxonomy is
    // wider than we can usefully close over, and getting it wrong would block
    // a pilot from describing their own aircraft. Only meaningful for manned.
    categoryClass: text("category_class"),
    // Type rating, where one is required. Nullable and usually null.
    typeRating: text("type_rating"),

    // Roadmap m4 — per-profile custom checklist items, appended to the base
    // checklist for this aircraft. jsonb array of strings.
    //
    // This is what makes the platform column actually useful: the shipped
    // checklist is DJI-shaped, so a manned aircraft needs both a different
    // base list AND the ability to add the items specific to the airframe.
    customChecklist: jsonb("custom_checklist").$type<string[]>().notNull().default([]),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Most common query: list current user's profiles, newest first.
    index("aircraft_profiles_user_idx").on(table.userId, table.createdAt),
  ],
);

export type AircraftProfile = typeof aircraftProfiles.$inferSelect;
export type NewAircraftProfile = typeof aircraftProfiles.$inferInsert;
