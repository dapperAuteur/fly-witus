import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Better Auth handles every /api/auth/* path: sign-in, sign-out, session,
// magic link verification, etc. Node runtime (default) is required because
// pg + drizzle don't run on Edge.
export const { GET, POST } = toNextJsHandler(auth);
