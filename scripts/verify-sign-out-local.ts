// Verification harness: plain "Sign out" ends ONLY Fly's session (witus task 128 option (b)).
//
// Run: npm run verify:sign-out
//
// better-auth 1.7 made RP-initiated logout the default for every genericOAuth provider: on
// signOut() it answers with the IdP's end_session_endpoint (plus id_token_hint) and the client
// follows it. That stranded people on accounts.witus.online/api/idp/oauth2/endsession and ended
// the shared WitUS session (BAM, 2026-10-31). `disableProviderLogout: true` on the witus
// provider turns that off. Two halves are pinned here:
//
//   1. THE CONFIG. src/lib/auth.ts keeps `disableProviderLogout: true` inside the witus
//      provider block. Remove it and this script fails.
//   2. THE BEHAVIOR, against the installed better-auth. A throwaway in-memory instance signs a
//      user with a linked witus account (carrying an id_token) out, and the response must
//      clear the session cookie and carry no provider-logout URL or Location header. The same
//      instance WITHOUT the flag must produce the end-session URL; if it ever stops doing so,
//      the first half is no longer testing anything and this script says so.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { genericOAuth } from "better-auth/plugins";

let failures = 0;
let checks = 0;

function ok(label: string, condition: boolean, detail = ""): void {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const ROOT = join(__dirname, "..");
/** Assertions about what the CODE does must not be satisfied (or broken) by a comment. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** The object literal that opens with `providerId: "witus"`, up to its closing brace. */
function witusProviderBlock(src: string): string {
  const start = src.indexOf('providerId: "witus"');
  if (start === -1) return "";
  const open = src.lastIndexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    if (src[i] === "}") depth -= 1;
    if (depth === 0) return src.slice(open, i + 1);
  }
  return "";
}

const BASE = "http://localhost:3000";

async function signOutOnce(disableProviderLogout: boolean) {
  const db: Record<string, unknown[]> = { user: [], session: [], account: [], verification: [] };
  const auth = betterAuth({
    baseURL: BASE,
    secret: "verify-sign-out-local-secret-not-a-real-one",
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true },
    logger: { disabled: true },
    plugins: [
      genericOAuth({
        config: [
          {
            providerId: "witus",
            authorizationUrl: "https://idp.invalid/authorize",
            tokenUrl: "https://idp.invalid/token",
            endSessionEndpoint: "https://idp.invalid/endsession",
            clientId: "verify-client",
            clientSecret: "verify-secret",
            ...(disableProviderLogout ? { disableProviderLogout: true } : {}),
          },
        ],
      }),
    ],
  });
  const { headers, response } = await auth.api.signUpEmail({
    body: { email: "pilot@example.invalid", password: "a-long-test-password", name: "Pilot" },
    returnHeaders: true,
  });
  const ctx = await auth.$context;
  await ctx.internalAdapter.createAccount({
    userId: response.user.id,
    providerId: "witus",
    accountId: "witus-sub-1",
    idToken: "header.payload.signature",
  });
  const cookie = (headers.get("set-cookie") ?? "").split(";")[0];
  const res = await auth.handler(
    new Request(`${BASE}/api/auth/sign-out`, {
      method: "POST",
      headers: { cookie, origin: BASE, "content-type": "application/json" },
      body: "{}",
    }),
  );
  const body = (await res.json()) as { success?: boolean; url?: string; redirect?: boolean };
  return {
    status: res.status,
    location: res.headers.get("location"),
    setCookie: res.headers.get("set-cookie") ?? "",
    body,
    sessionsLeft: db.session.length,
    hadSessionCookie: cookie.startsWith("better-auth.session_token="),
  };
}

async function main() {
  console.log("\nthe config — the witus provider keeps disableProviderLogout: true");
  {
    const block = witusProviderBlock(stripComments(readFileSync(join(ROOT, "src/lib/auth.ts"), "utf-8")));
    ok("src/lib/auth.ts has a witus provider block", block.length > 0);
    ok(
      "the witus provider sets disableProviderLogout: true",
      /\bdisableProviderLogout:\s*true\b/.test(block),
    );
  }

  console.log("\nthe behavior — plain sign-out clears the session and never hands off to the IdP");
  {
    const r = await signOutOnce(true);
    ok("the test user had a session cookie to clear", r.hadSessionCookie);
    ok("sign-out answers 200", r.status === 200, String(r.status));
    ok(
      "the session cookie is cleared",
      /better-auth\.session_token=;[^,]*Max-Age=0/.test(r.setCookie),
      r.setCookie,
    );
    ok("the session row is gone", r.sessionsLeft === 0, String(r.sessionsLeft));
    ok("no Location header", r.location === null, String(r.location));
    ok("no provider-logout URL in the body", r.body.url === undefined, JSON.stringify(r.body));
    ok("the client is not told to redirect", !r.body.redirect, JSON.stringify(r.body));
  }

  console.log("\nthe control — without the flag better-auth 1.7 DOES hand off (so the check above means something)");
  {
    const r = await signOutOnce(false);
    ok(
      "without disableProviderLogout the body carries the end-session URL",
      typeof r.body.url === "string" && r.body.url.startsWith("https://idp.invalid/endsession"),
      JSON.stringify(r.body),
    );
  }

  console.log(
    failures === 0
      ? `\n✅  ${checks} checks passed\n`
      : `\n❌  ${failures} of ${checks} checks FAILED\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

void main();
