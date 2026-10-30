"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, magicLinkClient } from "better-auth/client/plugins";
import type { auth } from "./auth";

// baseURL omitted on purpose — Better Auth defaults to window.location.origin,
// which matches our same-origin /api/auth/* handler in production and dev.
export const authClient = createAuthClient({
  // No genericOAuthClient(): better-auth 1.7 removed it. Generic OAuth providers (WitUS) now
  // start through the standard signIn.social({ provider }) API.
  plugins: [inferAdditionalFields<typeof auth>(), magicLinkClient()],
});

export const { signIn, signOut, useSession } = authClient;
