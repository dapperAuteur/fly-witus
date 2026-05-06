import { z } from "zod";

// Profile fields per v3 §4 (auth.ts users table). These are user-editable
// from the dashboard; account tier / cashapp / stripe / admin fields are
// NOT in this schema — those are managed by other flows (checkout webhook,
// admin queue, magic-link sign-in admin auto-grant).
//
// `image` (Better Auth core) is read-only here — Better Auth manages it.
// User-controlled avatar is `avatarUrl` per v3 §4.
export const profileUpdateSchema = z.object({
  displayName: z.string().trim().max(120).nullish(),
  avatarUrl: z
    .string()
    .trim()
    .max(500)
    .url("Avatar URL must be a valid URL")
    .nullish()
    .or(z.literal("").transform(() => null)),
  part107CertNumber: z.string().trim().max(40).nullish(),
  homeLocation: z.string().trim().max(200).nullish(),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
