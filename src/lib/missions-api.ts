// Shared zod schemas + types for the missions API. Keeps validation
// separate from the route handlers so it can be reused by future server
// actions, the WitUS Inbox webhook bus, or the offline-outbox flush.

import { z } from "zod";

// Allow any string-keyed checklist completion record. Values are boolean
// (checkbox state) or string (text/sub-field content).
const completedSchema = z.record(z.string(), z.union([z.boolean(), z.string()]));

const weatherSchema = z
  .object({
    temperature: z.string().nullish(),
    wind: z.string().nullish(),
    precipitation: z.string().nullish(),
  })
  .partial();

const flightSchema = z.object({
  flightNumber: z.number().int().nonnegative(),
  takeoffLocation: z.string().nullish(),
  landingLocation: z.string().nullish(),
  launchTime: z.string().nullish(),
  landingTime: z.string().nullish(),
  elapsedTime: z.string().nullish(),
  batteryVoltage: z.string().nullish(),
  notes: z.string().nullish(),
});

const photoSchema = z.object({
  url: z.string().url(),
  caption: z.string().nullish(),
});

export const missionInputSchema = z.object({
  missionNumber: z.string().min(1),
  timestamp: z.string().datetime(),
  pilotName: z.string().nullish(),
  location: z.string().nullish(),
  aircraftType: z.string().nullish(),
  rpCert: z.string().nullish(),
  profileId: z.string().nullish(),
  missionType: z
    .enum(["recreational", "bvc_primary_source", "commercial", "test_maintenance"])
    .default("recreational"),
  weather: weatherSchema.optional(),
  completed: completedSchema.default({}),
  laancAuthorizationNumber: z.string().nullish(),
  bvcEpisode: z.string().nullish(),
  wanderlearnCourseSlug: z.string().nullish(),
  partnerInstitution: z.string().nullish(),
  academicPurpose: z.string().nullish(),
  flights: z.array(flightSchema).default([]),
  photos: z.array(photoSchema).default([]),
});

export type MissionInput = z.infer<typeof missionInputSchema>;
