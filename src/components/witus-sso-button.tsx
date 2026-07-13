"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * "Sign in with WitUS" — starts the ecosystem OIDC flow against
 * accounts.witus.online. Rendered only when the SSO client is provisioned
 * (see `hasWitusSso`); the login page gates it. The ADMIN_EMAIL → is_admin
 * promotion in auth.ts (user.create.after) applies to WitUS accounts too.
 */
export function WitusSsoButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void authClient.signIn
          .oauth2({ providerId: "witus", callbackURL: `${window.location.origin}/` })
          .finally(() => setPending(false));
      }}
      className="w-full py-2 border border-border text-card-foreground rounded-lg hover:bg-muted font-semibold transition disabled:opacity-50"
    >
      {pending ? "Redirecting…" : "Sign in with WitUS"}
    </button>
  );
}
