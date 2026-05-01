import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// v3 §1: four mission types. 'free' anon users save locally; signed-in
// users tag their missions on save. Defaults to 'recreational'.
export const missionType = pgEnum("mission_type", [
  "recreational",
  "bvc_primary_source",
  "commercial",
  "test_maintenance",
]);

export const missions = pgTable(
  "missions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Display number — same as the localStorage key shape (YYYY-MM-DD-NNNN).
    // Not a unique constraint because two pilots could legitimately share
    // a number; uniqueness is on (userId, missionNumber).
    missionNumber: text("mission_number").notNull(),

    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),

    // Mission info — mirrors page.tsx form fields.
    pilotName: text("pilot_name"),
    location: text("location"),
    aircraftType: text("aircraft_type"),
    rpCert: text("rp_cert"),
    profileId: text("profile_id"), // refs aircraft_profiles when that table lands

    missionType: missionType("mission_type").notNull().default("recreational"),

    // Weather snapshot at save time. Three text columns (not jsonb) so
    // analytics queries (avg wind, etc.) can use plain SQL once we have
    // enough data to care.
    weatherTemperature: text("weather_temperature"),
    weatherWind: text("weather_wind"),
    weatherPrecipitation: text("weather_precipitation"),

    // Per-item checklist completion. Stored as jsonb because the shape is
    // open-ended (sub-fields, weather subitems, custom checklist items).
    // Same shape as MissionLog.completed in page.tsx.
    completed: jsonb("completed")
      .$type<Record<string, boolean | string>>()
      .notNull()
      .default({}),

    // v3 §3: LAANC authorization for controlled airspace flights.
    laancAuthorizationNumber: text("laanc_authorization_number"),

    // v3 §3: BVC Primary Source extras. All optional — only populated for
    // mission_type = 'bvc_primary_source'.
    bvcEpisode: text("bvc_episode"),
    wanderlearnCourseSlug: text("wanderlearn_course_slug"),
    partnerInstitution: text("partner_institution"),
    academicPurpose: text("academic_purpose"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Most common query: list current user's missions, newest first.
    index("missions_user_idx").on(table.userId, table.timestamp),
    // Idempotent retries from the offline-outbox: if the same userId +
    // missionNumber arrives twice (e.g. a flaky network during sync),
    // PG rejects the dupe and the client treats it as success.
    uniqueIndex("missions_user_number_unique").on(table.userId, table.missionNumber),
  ],
);

// One row per recorded flight within a mission. Times stored as text in
// HH:MM / HH:MM:SS form to match the existing UI inputs (page.tsx); migrating
// to real timestamps is a later concern once the UI uses time pickers.
export const flights = pgTable(
  "flights",
  {
    id: text("id").primaryKey(),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    flightNumber: integer("flight_number").notNull(),
    takeoffLocation: text("takeoff_location"),
    landingLocation: text("landing_location"),
    launchTime: text("launch_time"),
    landingTime: text("landing_time"),
    elapsedTime: text("elapsed_time"),
    batteryVoltage: text("battery_voltage"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("flights_mission_idx").on(table.missionId)],
);

// Per v3 §"Media Storage Architecture": URL references only, no hosting.
// Photos live on Cloudinary; this table stores the secure_url + caption.
export const missionPhotos = pgTable(
  "mission_photos",
  {
    id: text("id").primaryKey(),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    caption: text("caption"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("mission_photos_mission_idx").on(table.missionId)],
);

export type Mission = typeof missions.$inferSelect;
export type NewMission = typeof missions.$inferInsert;
export type Flight = typeof flights.$inferSelect;
export type NewFlight = typeof flights.$inferInsert;
export type MissionPhoto = typeof missionPhotos.$inferSelect;
export type NewMissionPhoto = typeof missionPhotos.$inferInsert;
