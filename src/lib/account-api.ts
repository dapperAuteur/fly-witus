import { z } from "zod";

// Shared validation for the self-service account actions.
export const changeEmailSchema = z.object({
  newEmail: z.string().trim().email().max(320),
});

export const deleteAccountSchema = z.object({
  // The UI requires the user to type DELETE to confirm — we re-check
  // server-side so a stray fetch can't nuke an account.
  confirm: z.literal("DELETE"),
});

export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
