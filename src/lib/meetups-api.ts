import { z } from "zod";

// Shared validation for the group-meetups API. Mirrors groups-api.ts.

export const MEETUP_RESPONSES = ["yes", "no", "maybe"] as const;
export type MeetupResponseValue = (typeof MEETUP_RESPONSES)[number];

const timeOptionSchema = z
  .object({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().optional(),
  })
  .refine(
    (o) => !o.endsAt || new Date(o.endsAt) > new Date(o.startsAt),
    { message: "End must be after start", path: ["endsAt"] },
  );

export const meetupCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  locationName: z.string().trim().max(200).optional(),
  // Optional initial time options; members can add more later.
  timeOptions: z.array(timeOptionSchema).max(20).optional(),
});

export const meetupUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  locationName: z.string().trim().max(200).nullable().optional(),
  // Lifecycle actions. `finalize` locks the meetup to one time option.
  action: z.enum(["finalize", "cancel", "complete", "reopen"]).optional(),
  finalOptionId: z.string().min(1).optional(),
});

export const addTimeOptionSchema = timeOptionSchema;

export const meetupResponseSchema = z.object({
  optionId: z.string().min(1),
  response: z.enum(MEETUP_RESPONSES),
});

export type MeetupCreateInput = z.infer<typeof meetupCreateSchema>;
