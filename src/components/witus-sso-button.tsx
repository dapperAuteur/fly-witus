"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  SILENT_SSO_TIMEOUT_MS,
  SSO_ATTEMPT_STORAGE_KEY,
  continueAsLabel,
  parseSilentSsoIdentity,
  silentSsoDecision,
  withAttemptMarker,
  type SsoIdentity,
} from "@/lib/silent-sso";

/**
 * "Sign in with WitUS" — starts the ecosystem OIDC flow against accounts.witus.online —
 * plus the silent "Continue as <name>" check layered on top of it.
 *
 * Rendered only when the SSO client is provisioned (see `hasWitusSso`); the login page gates
 * it. The ADMIN_EMAIL → is_admin promotion in auth.ts (user.create.after) applies to WitUS
 * accounts too.
 *
 * WHAT THE VISITOR SEES. The form is already on screen; nothing here delays it. The button
 * says "Sign in with WitUS" from the first paint. If the probe comes back with a live WitUS
 * session it becomes "Continue as <name>". If the probe fails, times out, is blocked by the
 * browser's third-party-cookie rules, or the IdP does not answer, nothing changes and nothing
 * is said — a failed silent check has to be completely invisible.
 *
 * The name is DISPLAY COPY, never a credential: it crossed an origin boundary, so it is
 * client-supplied by definition. Clicking still runs the real OIDC code flow, which is the
 * only thing that establishes identity here.
 */
export function WitusSsoButton({
  silentCheckUrl = null,
}: {
  /** Server-resolved IdP session endpoint, or null when ecosystem SSO is not configured. */
  silentCheckUrl?: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [identity, setIdentity] = useState<SsoIdentity | null>(null);

  useEffect(() => {
    const endpoint = silentCheckUrl;
    const decision = silentSsoDecision({
      endpoint,
      search: window.location.search,
      attempted: readAttempted(),
    });
    // `!endpoint` is already implied by decision.attempt; repeated so the narrowing belongs to
    // the compiler rather than to a cast that could quietly outlive the invariant.
    if (!decision.attempt || !endpoint) return;

    // Abort rather than hang. A probe still in flight when the visitor has moved on is a leak
    // of attention, not just of a socket.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SILENT_SSO_TIMEOUT_MS);
    let live = true;

    // `credentials: "include"` is the entire mechanism: the answer depends on the IdP's OWN
    // cookie, which is third-party from here. Browsers that partition or block third-party
    // cookies (Safari ITP, Firefox Total Cookie Protection) answer "nobody", and that is a
    // supported outcome — the visitor keeps the ordinary button.
    fetch(endpoint, {
      credentials: "include",
      mode: "cors",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!live) return;
        const found = parseSilentSsoIdentity(payload);
        // NEVER a credential. Display copy for a button whose click runs the real OIDC code
        // flow; it grants nothing on its own.
        if (found) setIdentity(found);
      })
      .catch(() => {
        // Invisible on purpose: network error, CORS refusal, abort, non-JSON body — all the same.
      })
      .finally(() => clearTimeout(timer));

    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [silentCheckUrl]);

  const start = useCallback(() => {
    setPending(true);
    // THE LOOP GUARD, written BEFORE the redirect and never after the return. Without it a
    // visitor whose IdP session has gone stale gets: probe says "Continue as X" → click → the
    // IdP cannot finish → back to /login → probe says "Continue as X" → forever. With it, one
    // attempt per tab: the second render offers the plain button and the email form, which
    // always work.
    writeAttempted();
    const origin = window.location.origin;
    void authClient.signIn
      .oauth2({
        providerId: "witus",
        callbackURL: `${origin}/`,
        // Belt and braces with the callback interceptor in src/app/api/auth/[...all]/route.ts.
        // Better Auth only reads errorCallbackURL for failures AFTER it parses the OAuth state,
        // so an error the IdP itself returns is handled there instead; this covers the rest
        // (token exchange, issuer mismatch) and carries the same one-shot marker.
        errorCallbackURL: `${origin}${withAttemptMarker("/login")}`,
      })
      .finally(() => setPending(false));
  }, []);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={start}
        className="w-full py-2 border border-border text-card-foreground rounded-lg hover:bg-muted font-semibold transition disabled:opacity-50"
      >
        {pending ? "Redirecting…" : continueAsLabel(identity)}
      </button>
      {/* Always in the DOM so the label change is announced when it happens, and silent (and
          invisible) when the probe found nothing. */}
      <p
        role="status"
        aria-live="polite"
        className={identity ? "mt-2 text-center text-xs text-muted-foreground" : "sr-only"}
      >
        {identity ? "Not you? Sign in with your email above." : ""}
      </p>
    </>
  );
}

/**
 * sessionStorage throws outright in some privacy modes, so both halves are wrapped. A browser
 * that cannot remember the attempt still gets the other half of the guard: the `?sso=tried`
 * marker the auth-callback interceptor puts on the URL.
 */
function readAttempted(): boolean {
  try {
    return window.sessionStorage.getItem(SSO_ATTEMPT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeAttempted(): void {
  try {
    window.sessionStorage.setItem(SSO_ATTEMPT_STORAGE_KEY, "1");
  } catch {
    // No storage, no marker. The query-param half still applies.
  }
}
