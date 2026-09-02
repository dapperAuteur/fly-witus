// Verification harness for src/lib/silent-sso.ts — the "Continue as <name>" check and
// global sign-out.
//
// Run: npm run verify:sso
//
// Pinned here in order of what each would cost if it broke:
//
//   1. THE REDIRECT LOOP. probe -> "Continue as X" -> click -> IdP declines -> back to
//      /login -> probe -> forever. It never appears in normal use, so it is simulated end to
//      end below rather than left to be discovered in production.
//   2. THE ENDPOINTS ARE DERIVED, NEVER INVENTED. Both the probe and the logout URL come out
//      of the discovery URL this app is already configured with. In particular the probe must
//      never resolve to Better Auth's /get-session, whose body carries a session token.
//   3. INVISIBLE FAILURE. Nothing the probe can return may produce an error, a stuck spinner,
//      or a claim about who the visitor is.
//   4. THE NAME IS DISPLAY COPY. It crossed an origin boundary, so it is untrusted input even
//      though it only ever lands on a button.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SILENT_AUTH_FAILURES,
  SSO_ATTEMPT_STORAGE_KEY,
  continueAsLabel,
  endSessionEndpointFromDiscovery,
  hasAttemptMarker,
  isSilentAuthFailure,
  parseSilentSsoIdentity,
  silentSsoDecision,
  silentSsoEndpointFromDiscovery,
  silentSsoRecoveryPath,
  withAttemptMarker,
} from "../src/lib/silent-sso";

let failures = 0;
let checks = 0;

function expect(label: string, actual: unknown, want: unknown): void {
  checks += 1;
  if (JSON.stringify(actual) !== JSON.stringify(want)) {
    failures += 1;
    console.error(
      `  FAIL  ${label}\n        want ${JSON.stringify(want)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function ok(label: string, condition: boolean, detail = ""): void {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");
/** Assertions about what the CODE does must not be satisfied (or broken) by a comment. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const DISCOVERY = "https://accounts.witus.online/api/idp/.well-known/openid-configuration";
const ENDPOINT = "https://accounts.witus.online/api/ecosystem/session";

console.log("\nthe gate — the probe never fires without a configured client");
for (const endpoint of [null, undefined, ""]) {
  expect(`endpoint ${JSON.stringify(endpoint)} stays dark`, silentSsoDecision({ endpoint, search: "" }), {
    attempt: false,
    skip: "not-configured",
  });
}
expect("a clean first visit attempts", silentSsoDecision({ endpoint: ENDPOINT, search: "" }), {
  attempt: true,
});
expect(
  "never asks on behalf of someone already signed in",
  silentSsoDecision({ endpoint: ENDPOINT, signedIn: true }),
  { attempt: false, skip: "already-signed-in" },
);

console.log("\nthe redirect loop — simulating an IdP that will not sign the visitor in");
{
  // 1. First arrival: no marker anywhere.
  let storage = false;
  let search = "";
  expect(
    "1. first arrival attempts",
    silentSsoDecision({ endpoint: ENDPOINT, search, attempted: storage }),
    { attempt: true },
  );

  // 2. The probe answered, the visitor clicked, and the marker is written BEFORE the redirect.
  storage = true;

  // 3. The IdP declines. This is what comes back to our callback.
  const declined = new URL(
    "https://fly.witus.online/api/auth/oauth2/callback/witus?error=login_required&error_description=Authentication+required",
  );
  const recovery = silentSsoRecoveryPath(declined);
  expect("3. a decline recovers to the login form", recovery, "/login?sso=tried");
  search = new URL(recovery as string, "https://fly.witus.online").search;

  // 4. Back on the login page. Both halves of the marker now say stop.
  expect(
    "4. both halves stop the second attempt",
    silentSsoDecision({ endpoint: ENDPOINT, search, attempted: storage }),
    { attempt: false, skip: "already-attempted" },
  );
  // 5. sessionStorage alone stops it (the visitor navigated back to a bare /login).
  expect(
    "5. sessionStorage alone stops it",
    silentSsoDecision({ endpoint: ENDPOINT, search: "", attempted: true }),
    { attempt: false, skip: "already-attempted" },
  );
  // 6. The query param alone stops it — the case that matters where sessionStorage throws.
  expect(
    "6. the query param alone stops it",
    silentSsoDecision({ endpoint: ENDPOINT, search, attempted: false }),
    { attempt: false, skip: "already-attempted" },
  );
}

{
  const component = read("src/components/witus-sso-button.tsx");
  const write = component.indexOf("writeAttempted();");
  const redirect = component.indexOf("authClient.signIn");
  ok("the marker is written in the click handler", write > -1);
  ok("the redirect is in the click handler", redirect > -1);
  // A marker written after the redirect is a marker that never exists when the return is the
  // thing that failed — which is precisely the loop.
  ok("the marker is written BEFORE the redirect, never after the return", write < redirect);
  expect("the storage key is the ecosystem-wide one", SSO_ATTEMPT_STORAGE_KEY, "witus.sso.attempted");
}

console.log("\nthe recovery path is narrow");
for (const code of SILENT_AUTH_FAILURES) {
  expect(
    `${code} recovers`,
    silentSsoRecoveryPath(
      new URL(`https://fly.witus.online/api/auth/oauth2/callback/witus?error=${code}`),
    ),
    "/login?sso=tried",
  );
}
// A real fault must still surface the way it does today.
expect(
  "server_error is left to Better Auth",
  silentSsoRecoveryPath(
    new URL("https://fly.witus.online/api/auth/oauth2/callback/witus?error=server_error"),
  ),
  null,
);
// A success must never be swallowed.
expect(
  "a successful callback is untouched",
  silentSsoRecoveryPath(
    new URL("https://fly.witus.online/api/auth/oauth2/callback/witus?code=abc&state=xyz"),
  ),
  null,
);
// Every other auth route is untouched — magic link is the primary sign-in here.
expect(
  "magic-link verification is untouched",
  silentSsoRecoveryPath(new URL("https://fly.witus.online/api/auth/magic-link/verify?token=t")),
  null,
);
expect(
  "get-session is untouched",
  silentSsoRecoveryPath(new URL("https://fly.witus.online/api/auth/get-session")),
  null,
);
expect(
  "another provider's callback is untouched",
  silentSsoRecoveryPath(
    new URL("https://fly.witus.online/api/auth/oauth2/callback/other?error=login_required"),
  ),
  null,
);
expect("only the five decline codes classify", isSilentAuthFailure("login_required"), true);
expect("access_denied classifies (the cancel case)", isSilentAuthFailure("access_denied"), true);
expect("invalid_request does not", isSilentAuthFailure("invalid_request"), false);
expect("null does not", isSilentAuthFailure(null), false);

console.log("\nthe one-shot marker");
expect("reads ?sso=tried", hasAttemptMarker("?sso=tried"), true);
expect("reads a bare query string", hasAttemptMarker("sso=tried"), true);
expect("reads it alongside others", hasAttemptMarker("?a=b&sso=tried"), true);
expect("rejects another value", hasAttemptMarker("?sso=something-else"), false);
expect("is not fooled by a path", hasAttemptMarker("?next=/sso=tried"), false);
expect("empty is no marker", hasAttemptMarker(""), false);
expect("null is no marker", hasAttemptMarker(null), false);
expect("marks a bare path", withAttemptMarker("/login"), "/login?sso=tried");
expect("keeps an existing query", withAttemptMarker("/login?a=b"), "/login?a=b&sso=tried");
expect("keeps the hash", withAttemptMarker("/login#top"), "/login?sso=tried#top");
expect(
  "is idempotent so a second pass cannot stack duplicates",
  withAttemptMarker(withAttemptMarker("/login?a=b")),
  withAttemptMarker("/login?a=b"),
);

console.log("\nthe endpoints are derived, never invented");
expect("the probe URL comes out of the discovery URL", silentSsoEndpointFromDiscovery(DISCOVERY), ENDPOINT);
// The probe lives at a FIXED path on the IdP's ORIGIN, not under its Better Auth basePath.
expect(
  "an IdP mounted at the root derives the same route",
  silentSsoEndpointFromDiscovery("https://id.example.test/.well-known/openid-configuration"),
  "https://id.example.test/api/ecosystem/session",
);
// THE POINT OF THIS CHECK. /get-session returns { session, user } and `session` carries the
// SESSION TOKEN, so a credentialed cross-origin probe against it would let any ecosystem
// origin — or an XSS on one — lift a live IdP session token.
for (const discovery of [DISCOVERY, "https://id.example.test/.well-known/openid-configuration"]) {
  ok(
    "the probe never resolves to Better Auth's /get-session",
    !silentSsoEndpointFromDiscovery(discovery)?.includes("get-session"),
    discovery,
  );
}
// Global sign-out. Unlike the probe, this one DOES live under the Better Auth basePath — it is
// the end_session_endpoint the discovery document advertises.
expect(
  "the logout URL sits under the IdP basePath",
  endSessionEndpointFromDiscovery(DISCOVERY),
  "https://accounts.witus.online/api/idp/oauth2/endsession",
);
for (const bad of [null, undefined, "", "not a url", "https://accounts.witus.online/api/idp"]) {
  expect(
    `probe returns null rather than guessing from ${JSON.stringify(bad)}`,
    silentSsoEndpointFromDiscovery(bad),
    null,
  );
  expect(
    `logout returns null rather than guessing from ${JSON.stringify(bad)}`,
    endSessionEndpointFromDiscovery(bad),
    null,
  );
}
{
  // Two files name this URL. If they ever disagree the silent check would probe a different
  // host than the one the click actually signs in against — so auth.ts must not carry its own.
  const authCode = stripComments(read("src/lib/auth.ts"));
  ok(
    "src/lib/auth.ts uses the shared discovery fallback, not its own literal",
    authCode.includes("WITUS_OIDC_DISCOVERY_FALLBACK") && !authCode.includes("openid-configuration"),
  );
  ok(
    "the shared fallback is the live IdP discovery document",
    read("src/lib/env.ts").includes(`"${DISCOVERY}"`),
  );
}

console.log("\nreading the probe answer");
expect(
  "finds the name in the IdP's shape",
  parseSilentSsoIdentity({ signedIn: true, user: { name: "Brand Anthony McDonald" } }),
  { label: "Brand Anthony McDonald" },
);
expect(
  "an explicit signedIn:false is the answer",
  parseSilentSsoIdentity({ signedIn: false, user: { name: "Ada" } }),
  null,
);
expect("accepts a bare user object", parseSilentSsoIdentity({ name: "Ada" }), { label: "Ada" });
expect(
  "falls back to the email",
  parseSilentSsoIdentity({ user: { name: "", email: "ada@example.test" } }),
  { label: "ada@example.test" },
);
for (const empty of [null, undefined, {}, { user: null }, { user: { id: "u1" } }, "Ada", 42, [{ name: "Ada" }]]) {
  expect(`${JSON.stringify(empty) ?? "undefined"} means nobody`, parseSilentSsoIdentity(empty), null);
}
// The answer comes from another origin, so it is untrusted input even though it is only ever
// display copy. Control characters go, whitespace is trimmed, absurd lengths are capped.
expect("trims", parseSilentSsoIdentity({ name: "  Ada Lovelace " }), { label: "Ada Lovelace" });
expect(
  "strips control characters",
  parseSilentSsoIdentity({ name: "Ada\u0000\u001bLovelace" }),
  { label: "AdaLovelace" },
);
expect("whitespace-only is nobody", parseSilentSsoIdentity({ name: "   " }), null);
ok(
  "caps an absurd length",
  (parseSilentSsoIdentity({ name: "N".repeat(300) })?.label.length ?? 999) <= 48,
);
expect("the signed-out label", continueAsLabel(null), "Sign in with WitUS");
expect("the signed-in label", continueAsLabel({ label: "Ada" }), "Continue as Ada");

console.log("\na failed check is invisible, and the button never builds its own URL");
{
  const component = read("src/components/witus-sso-button.tsx");
  const code = stripComments(component);
  ok("every probe outcome is swallowed", component.includes(".catch(() => {"));
  // No error state to render and no loading state that could hang: the button is fully usable
  // from first paint and only ever gains a better label.
  ok("no error state", !/useState[^\n]*[Ee]rror/.test(code));
  ok("no loading state", !/useState[^\n]*[Ll]oading/.test(code));
  ok("the probe cannot hang the page open", code.includes("SILENT_SSO_TIMEOUT_MS"));
  ok("the probe is aborted", code.includes("controller.abort()"));
  // Exactly one network call, and the decision function is what guards it.
  ok("exactly one fetch", code.split("fetch(").length - 1 === 1);
  ok("the decision function guards it", code.includes("if (!decision.attempt || !endpoint) return;"));
  // Comments may name the IdP; CODE must not. A URL literal here would be a client-side
  // default that could outlive the server-side gate.
  ok("the button hardcodes no IdP URL", !code.includes("https://") && !code.includes("witus.online"));
  ok("it only asks the server-resolved endpoint", code.includes("const endpoint = silentCheckUrl;"));
  // The endpoint is passed from the server component, never read from env in the browser.
  const page = read("src/app/(auth)/login/page.tsx");
  ok("the login page resolves the endpoint server-side", page.includes("witusSilentSsoEndpoint"));
}

console.log("\nglobal sign-out — the local session dies first");
{
  const ecosystem = stripComments(read("src/lib/witus-ecosystem.tsx"));
  // The trailing slash is exact-matched by the IdP against the registered redirectUrls.
  ok(
    "post_logout_redirect_uri is origin + trailing slash",
    ecosystem.includes("`${window.location.origin}/`"),
  );
  ok("it is URL-encoded", ecosystem.includes("encodeURIComponent(back)"));
  // `&` not `?`: client_id is already on the URL, baked in server-side.
  ok("appended with &, since client_id is already there", ecosystem.includes("&post_logout_redirect_uri="));
  // A full navigation, not a router push: this leaves our origin.
  ok("a full navigation", ecosystem.includes("window.location.assign("));
  ok("the client never reads the raw env", !ecosystem.includes("process.env"));
  ok(
    "client_id is baked in on the server",
    stripComments(read("src/lib/env.ts")).includes("?client_id=${encodeURIComponent("),
  );

  // ORDER IS THE SAFETY PROPERTY. If the IdP is unreachable the person must still be signed
  // out here, so every call site destroys the local session BEFORE handing off.
  for (const rel of [
    "src/components/app-nav.tsx",
    "src/app/dashboard/_components/account-section.tsx",
  ]) {
    const src = stripComments(read(rel));
    const local = src.indexOf("await signOut();");
    const handoff = src.indexOf("endWitusSession()");
    ok(`${rel}: destroys the local session`, local > -1);
    ok(`${rel}: hands off to the IdP`, handoff > -1);
    ok(`${rel}: local sign-out happens FIRST`, local > -1 && handoff > -1 && local < handoff);
  }
  // Label tells the truth about scope in both states.
  const nav = read("src/components/app-nav.tsx");
  ok('nav says "Sign out of WitUS" when global', nav.includes('"Sign out of WitUS"'));
  ok('nav falls back to plain "Sign out"', nav.includes('"Sign out"'));
}

console.log(
  failures === 0
    ? `\n✅  ${checks} checks passed\n`
    : `\n❌  ${failures} of ${checks} checks FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
