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

export type GroupCreateInput = z.infer<typeof groupCreateSchema>;
export type GroupUpdateInput = z.infer<typeof groupUpdateSchema>;
export type ShareMissionInput = z.infer<typeof shareMissionSchema>;
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
