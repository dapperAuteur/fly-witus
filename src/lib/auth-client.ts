"use client";

import { createAuthClient } from "better-auth/react";
import {
  genericOAuthClient,
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins";
import type { auth } from "./auth";

// baseURL omitted on purpose — Better Auth defaults to window.location.origin,
// which matches our same-origin /api/auth/* handler in production and dev.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), magicLinkClient(), genericOAuthClient()],
});

export const { signIn, signOut, useSession } = authClient;
