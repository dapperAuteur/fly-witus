// Shared zod schemas + helpers for the groups API. Mirrors the pattern
// used by missions-api.ts so server actions / future Inbox webhooks can
// reuse the validation.

import { customAlphabet } from "nanoid";
import { z } from "zod";

// 8-char invite code, no I/O/0/1 to avoid OCR/visual confusion. URL-safe
// without escaping.
const inviteAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const generateInviteCode = customAlphabet(inviteAlphabet, 8);

export const groupCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});

export const groupUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export const shareMissionSchema = z.object({
  missionId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().trim().min(4).max(20),
});

const missionTypes = [
  "recreational",
  "bvc_primary_source",
  "commercial",
  "test_maintenance",
] as const;

export const flightRequestCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2000),
  missionType: z.enum(missionTypes),
  location: z.string().trim().max(200).optional(),
  // Accept ISO date string or undefined; coerce to Date in the route.
  targetDate: z.string().datetime().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  assignedToId: z.string().min(1).optional(),
  bvcEpisode: z.string().trim().max(120).optional(),
  wanderlearnCourseSlug: z.string().trim().max(120).optional(),
  partnerInstitution: z.string().trim().max(160).optional(),
  academicPurpose: z.string().trim().max(500).optional(),
});

export const flightRequestCompleteSchema = z.object({
  missionId: z.string().min(1),
});

export const flightRequestCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export type GroupCreateInput = z.infer<typeof groupCreateSchema>;
export type GroupUpdateInput = z.infer<typeof groupUpdateSchema>;
export type ShareMissionInput = z.infer<typeof shareMissionSchema>;
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
export type FlightRequestCreateInput = z.infer<typeof flightRequestCreateSchema>;
export type FlightRequestCompleteInput = z.infer<typeof flightRequestCompleteSchema>;
export type FlightRequestCommentInput = z.infer<typeof flightRequestCommentSchema>;
