/**
 * "Continue as <name>" — the silent ecosystem-SSO check, plus the derived IdP endpoints
 * "Sign out of WitUS everywhere" needs.
 *
 * THE COMPLAINT. Signing in on fly.witus.online sends you to the WitUS login page even when
 * another tab already has you signed in to a WitUS app. BAM chose OPTION B on 2026-08-30:
 * render the login form immediately, ask the question in parallel, and offer
 * "Continue as <name>" once the answer arrives. NOT fully automatic — that is what keeps the
 * latency off the common case (most people hitting a login page are signed in nowhere) and
 * keeps the redirect loop mostly impossible.
 *
 * WHY A CROSS-ORIGIN PROBE AND NOT `prompt=none`. `prompt=none` is a NAVIGATION: you leave the
 * login page to ask, which is the automatic design BAM rejected, and the only way to ask
 * without leaving is a hidden iframe, which Safari's ITP already blocks. So we ask a dedicated
 * IdP endpoint over CORS instead, in parallel with a form that has already rendered.
 *
 * WHAT IT BUYS AND WHAT IT DOES NOT. The probe carries the IdP's cookie as a THIRD-PARTY
 * cookie, so it answers on Chrome/Edge and returns nothing under Safari ITP or Firefox Total
 * Cookie Protection. That is the design, not a bug: a probe that answers nothing renders
 * nothing and the visitor keeps the exact login page they already had.
 *
 * THE IDENTITY THIS RETURNS IS DISPLAY ONLY. It arrives from a cross-origin response, so it is
 * client-supplied by definition and MUST NEVER authenticate anyone. Clicking
 * "Continue as <name>" runs the real OIDC code flow, which is where identity is actually
 * established. Nothing in this file may ever be used to grant access.
 *
 * Pure helpers by design: no `server-only`, no next/headers, no `window` at module scope, so
 * both src/lib/env.ts (server) and the button (client) can import it and
 * scripts/verify-silent-sso.ts can exercise it directly.
 */

/** Query param that marks "this browser already tried the ecosystem flow on this page". */
export const SSO_ATTEMPT_PARAM = "sso";
export const SSO_ATTEMPT_VALUE = "tried";

/**
 * sessionStorage key for the same marker. Written IMMEDIATELY BEFORE we send the browser to
 * the IdP, never after we come back: a marker written on return is a marker that never exists
 * when the return is the thing that failed.
 */
export const SSO_ATTEMPT_STORAGE_KEY = "witus.sso.attempted";

/** How long to wait for the probe before giving up. A silent check that hangs is a broken page. */
export const SILENT_SSO_TIMEOUT_MS = 4000;

/** Longest display name we will render. Caps a hostile or absurd value from blowing up the card. */
const MAX_LABEL_LENGTH = 48;

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * OIDC authorization-error codes that mean "the IdP will not complete this without a human".
 *
 * `login_required` / `interaction_required` / `consent_required` /
 * `account_selection_required` are what an IdP with no usable session returns;
 * `access_denied` is the one that fires on the interactive path when the visitor clicked
 * "Continue as …" and then cancelled at the IdP.
 *
 * All five share one correct response: put the visitor back on the login form with no error.
 * Without the interceptor in src/app/api/auth/[...all]/route.ts they instead land on Better
 * Auth's raw /api/auth/error page, because the generic-OAuth callback redirects on
 * `ctx.query.error` BEFORE it parses the state that carries our `errorCallbackURL`.
 */
export const SILENT_AUTH_FAILURES = [
  "login_required",
  "interaction_required",
  "consent_required",
  "account_selection_required",
  "access_denied",
] as const;

export function isSilentAuthFailure(error: string | null | undefined): boolean {
  return typeof error === "string" && (SILENT_AUTH_FAILURES as readonly string[]).includes(error);
}

/** Identity shown on the button. Display only, never a credential. */
export interface SsoIdentity {
  /** What "Continue as ___" says. Already trimmed, de-controlled, and length-capped. */
  label: string;
}

export type SilentSsoSkip = "not-configured" | "already-attempted" | "already-signed-in";

export type SilentSsoDecision = { attempt: true } | { attempt: false; skip: SilentSsoSkip };

/**
 * Should this browser ask the IdP who it is?
 *
 * `endpoint` is resolved on the SERVER (src/lib/env.ts) and is null whenever this app is not a
 * configured ecosystem OIDC client, which keeps the whole feature dark rather than offering an
 * affordance the visitor cannot complete. Fly WitUS is single-tenant on one WitUS-branded host,
 * so unlike witus-learn there is no per-tenant gate to add on top of it.
 */
export function silentSsoDecision(input: {
  endpoint: string | null | undefined;
  search?: string | null;
  attempted?: boolean;
  signedIn?: boolean;
}): SilentSsoDecision {
  if (!input.endpoint) return { attempt: false, skip: "not-configured" };
  if (input.signedIn) return { attempt: false, skip: "already-signed-in" };
  if (input.attempted || hasAttemptMarker(input.search)) {
    return { attempt: false, skip: "already-attempted" };
  }
  return { attempt: true };
}

/** Does this query string carry the one-shot marker? Accepts "?a=b" or "a=b". */
export function hasAttemptMarker(search: string | null | undefined): boolean {
  if (typeof search !== "string" || search === "") return false;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get(SSO_ATTEMPT_PARAM) === SSO_ATTEMPT_VALUE;
}

/** Add the one-shot marker to a same-origin path, preserving any query and hash it already has. */
export function withAttemptMarker(path: string): string {
  const [beforeHash, ...hashRest] = path.split("#");
  const hash = hashRest.length > 0 ? `#${hashRest.join("#")}` : "";
  const [pathname, ...queryRest] = beforeHash.split("?");
  const params = new URLSearchParams(queryRest.join("?"));
  params.set(SSO_ATTEMPT_PARAM, SSO_ATTEMPT_VALUE);
  return `${pathname}?${params.toString()}${hash}`;
}

/**
 * Split a discovery URL into the IdP's origin and its Better Auth basePath.
 *
 *   https://accounts.witus.online/api/idp/.well-known/openid-configuration
 *     -> { origin: "https://accounts.witus.online", basePath: "/api/idp" }
 *
 * Everything below derives from this rather than naming accounts.witus.online a second time,
 * so the one external value this app asserts stays the discovery URL src/lib/auth.ts is
 * already configured with (authoritative-values rule).
 */
function splitDiscoveryUrl(
  discoveryUrl: string | null | undefined,
): { origin: string; basePath: string } | null {
  if (!discoveryUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(discoveryUrl);
  } catch {
    return null;
  }
  const cut = parsed.pathname.indexOf("/.well-known/");
  if (cut < 0) return null;
  return { origin: parsed.origin, basePath: parsed.pathname.slice(0, cut) };
}

/**
 * The IdP's RP-initiated logout endpoint: `<basePath>/oauth2/endsession`, which is the
 * `end_session_endpoint` the discovery document advertises.
 *
 * Used only by the separate "Sign out of WitUS everywhere" control. The plain "Sign out" ends
 * only this app's session (BAM, 2026-10-29, witus task 128 option (b), replacing the 2026-08-30
 * global sign-out), so after it the IdP session is alive and "Continue as …" offering to sign
 * you straight back in is the intended behaviour, not a broken logout.
 */
export function endSessionEndpointFromDiscovery(
  discoveryUrl: string | null | undefined,
): string | null {
  const parts = splitDiscoveryUrl(discoveryUrl);
  if (!parts) return null;
  return `${parts.origin}${parts.basePath}/oauth2/endsession`;
}

/**
 * The ecosystem session probe: `<idp-origin>/api/ecosystem/session`.
 *
 * Deliberately NOT `<basePath>/get-session`. That route returns the full `{ session, user }`
 * and `session` carries the SESSION TOKEN, so a credentialed cross-origin probe against it
 * would let any ecosystem origin — or an XSS on one — lift a live IdP session token. (It also
 * emits no CORS headers, so it could never have answered anyway.) `/api/ecosystem/session` is
 * the purpose-built replacement in gemini/witus: same cookie, but it answers with a display
 * label and nothing else, and its allow-origin list comes from the IdP's own client registry.
 *
 * Note the path is fixed on the IdP's ORIGIN, not under its Better Auth basePath.
 */
export function silentSsoEndpointFromDiscovery(
  discoveryUrl: string | null | undefined,
): string | null {
  const parts = splitDiscoveryUrl(discoveryUrl);
  if (!parts) return null;
  return `${parts.origin}/api/ecosystem/session`;
}

/**
 * Read a display name out of the probe response.
 *
 * Shapes handled: `{ signedIn, user: { name } }` (what the IdP sends), a bare user object, and
 * every signed-out shape — including a 200 with a null body. Anything else yields null, which
 * renders nothing.
 */
export function parseSilentSsoIdentity(payload: unknown): SsoIdentity | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  // An explicit `signedIn: false` is the answer, whatever else the body happens to carry.
  if (root.signedIn === false) return null;
  const candidate =
    root.user && typeof root.user === "object" ? (root.user as Record<string, unknown>) : root;
  const label = cleanLabel(candidate.name) ?? cleanLabel(candidate.email);
  return label ? { label } : null;
}

function cleanLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(CONTROL_CHARS, "").trim();
  if (!cleaned) return null;
  return cleaned.length > MAX_LABEL_LENGTH
    ? `${cleaned.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…`
    : cleaned;
}

/** Button copy. Kept here so the verify script pins the exact string the visitor reads. */
export function continueAsLabel(identity: SsoIdentity | null): string {
  return identity ? `Continue as ${identity.label}` : "Sign in with WitUS";
}

/**
 * Turn a failed ecosystem callback into a quiet return to the login form.
 *
 * Deliberately NARROW: only this app's own witus callback path, and only the five codes in
 * SILENT_AUTH_FAILURES, so a real fault (token-exchange failure, issuer mismatch) still
 * surfaces the way it does today instead of being swallowed into a blank login page.
 *
 * The returned path carries the one-shot marker, which is the half of the loop guard that
 * survives a browser where sessionStorage throws or is empty.
 */
export function silentSsoRecoveryPath(url: URL, loginPath = "/login"): string | null {
  // better-auth 1.7 serves the callback at /api/auth/callback/witus (1.6 used
  // /api/auth/oauth2/callback/witus); the pattern matches both.
  if (!/\/callback\/witus\/?$/.test(url.pathname)) return null;
  if (!isSilentAuthFailure(url.searchParams.get("error"))) return null;
  return withAttemptMarker(loginPath);
}
