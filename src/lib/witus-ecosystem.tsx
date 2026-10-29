"use client";

import { createContext, useCallback, useContext } from "react";

/**
 * Shares the WitUS IdP's end-session URL with every client component that can sign someone out.
 *
 * WHY A CONTEXT AND NOT A PROP. The URL has to be resolved on the SERVER (src/lib/env.ts
 * bakes the required `client_id` into it) because a client component must never read the raw
 * env. But sign-out lives in two places — the nav in the root layout and the account panel
 * inside a client-rendered dashboard page — and only the root layout is a Server Component.
 * Reading it once there and publishing it through this provider keeps both call sites correct
 * without a chain of props through a client tree.
 *
 * `null` is the ordinary, supported state: no ecosystem OIDC client configured means there is
 * no shared session to end, so the "Sign out of WitUS everywhere" control does not render.
 * The plain "Sign out" is local in every state (BAM, 2026-10-29, witus task 128 option (b)).
 */
const WitusEndSessionContext = createContext<string | null>(null);

export function WitusEcosystemProvider({
  endSessionUrl,
  children,
}: {
  endSessionUrl: string | null;
  children: React.ReactNode;
}) {
  return (
    <WitusEndSessionContext.Provider value={endSessionUrl}>
      {children}
    </WitusEndSessionContext.Provider>
  );
}

/** The IdP end-session URL, or null when "Sign out of WitUS everywhere" is not available. */
export function useWitusEndSession(): string | null {
  return useContext(WitusEndSessionContext);
}

/**
 * Hand off to the IdP to end the SHARED WitUS session. Used ONLY by the separate "Sign out of
 * WitUS everywhere" control (src/components/sign-out-everywhere-button.tsx); the plain "Sign out"
 * never calls it (BAM, 2026-10-29, witus task 128 option (b)). Other WitUS apps keep their own
 * sessions until the person signs out of them.
 *
 * CALL THIS ONLY AFTER THE LOCAL SESSION IS ALREADY DESTROYED. Order is the safety property:
 * if the IdP is unreachable, refuses, or the redirect never completes, the person is still
 * signed out here. Handing off first turns any IdP failure into "I clicked sign out and I'm
 * still signed in".
 *
 * Returns a `go` that is null when there is nothing to hand off to, so the control can render
 * nothing in that state.
 */
export function useEndWitusSession(): (() => void) | null {
  const endSessionUrl = useWitusEndSession();
  const go = useCallback(() => {
    if (!endSessionUrl) return;
    // The trailing slash is REQUIRED. Better Auth exact-matches post_logout_redirect_uri
    // against the client's registered redirectUrls, and the IdP registry
    // (gemini/witus lib/identity/clients.ts) registers `origin + "/"` — so in production this
    // must resolve to exactly https://fly.witus.online/. Drop the slash and the IdP returns
    // invalid_request.
    const back = `${window.location.origin}/`;
    // `&`, not `?`: the URL already carries client_id (baked in server-side, see
    // witusEndSessionEndpoint in src/lib/env.ts). client_id is required — Better Auth rejects
    // a post_logout_redirect_uri with invalid_request unless the request carries either a
    // verifiable id_token_hint or an explicit client_id, and we have no id_token client-side.
    //
    // A full navigation, not router.push: this leaves our origin for the IdP, which then
    // returns to `back`.
    window.location.assign(`${endSessionUrl}&post_logout_redirect_uri=${encodeURIComponent(back)}`);
  }, [endSessionUrl]);
  return endSessionUrl ? go : null;
}
