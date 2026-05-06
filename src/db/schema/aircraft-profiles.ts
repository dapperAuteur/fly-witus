import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
