import { z } from "zod";

// Shared zod schemas for the aircraft-profiles API. POST and PATCH share
// the same field set; PATCH is .partial() so any subset can be updated.

export const aircraftProfileInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  model: z.string().trim().max(120).nullish(),
  // Weight in grams. Integer, nullable. UI may accept "350g" / "1.2kg"
  // free-form; normalize before POST. 0 isn't useful but allowed for
  // unknown-weight rows; cap at 25kg = 25000g (commercial heavy-lift).
  weightGrams: z.number().int().min(0).max(25_000).nullish(),
  regNumber: z.string().trim().max(60).nullish(),
  notes: z.string().trim().max(2_000).nullish(),

  // plans/08 Phase 2a. Defaults to "uas" so existing clients that do not send
  // the field keep creating drone profiles, which is what they mean.
  platform: z.enum(["uas", "manned"]).default("uas"),
  categoryClass: z.string().trim().max(60).nullish(),
  typeRating: z.string().trim().max(60).nullish(),
  // Roadmap m4. Capped at 50 items of 200 chars — generous for a real
  // checklist, tight enough that the jsonb column cannot be used as storage
  // for something it was not meant for.
  customChecklist: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
});

export const aircraftProfileUpdateSchema = aircraftProfileInputSchema.partial();

export type AircraftProfileInput = z.infer<typeof aircraftProfileInputSchema>;
export type AircraftProfileUpdate = z.infer<typeof aircraftProfileUpdateSchema>;
