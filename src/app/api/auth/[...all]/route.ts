import { auth } from "@/lib/auth";
import { silentSsoRecoveryPath } from "@/lib/silent-sso";
import { toNextJsHandler } from "better-auth/next-js";

// Better Auth handles every /api/auth/* path: sign-in, sign-out, session,
// magic link verification, etc. Node runtime (default) is required because
// pg + drizzle don't run on Edge.
const handlers = toNextJsHandler(auth);

/**
 * One narrow interception ahead of Better Auth: an ecosystem sign-in the IdP declined.
 *
 * When the WitUS IdP answers our OIDC callback with `error=login_required` (or one of its four
 * siblings — see SILENT_AUTH_FAILURES) it means "no session, and I will not make one without a
 * human". Better Auth redirects on `ctx.query.error` BEFORE it parses the OAuth state that
 * carries our `errorCallbackURL`, so without this the visitor lands on Better Auth's raw
 * /api/auth/error page instead of the login form.
 *
 * The recovery path carries `?sso=tried`, which is the half of the loop guard that survives a
 * browser where sessionStorage throws or is empty. Everything else — a real token-exchange
 * failure, an issuer mismatch, any other route — falls straight through to Better Auth
 * unchanged.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const recovery = silentSsoRecoveryPath(url);
  if (recovery) {
    // Relative Location: the browser resolves it against whichever origin it arrived on.
    return new Response(null, { status: 302, headers: { location: recovery } });
  }
  // better-auth 1.7 compatibility shim. The IdP still sends the browser to the registered
  // /api/auth/oauth2/callback/witus (see redirectURI in src/lib/auth.ts), but 1.7 handles OAuth
  // callbacks only at /api/auth/callback/:id. Forward code/state intact.
  const legacyCallback = /^\/api\/auth\/oauth2\/callback\/([^/]+)\/?$/.exec(url.pathname);
  if (legacyCallback) {
    return new Response(null, {
      status: 307,
      headers: { location: `/api/auth/callback/${legacyCallback[1]}${url.search}` },
    });
  }
  return handlers.GET(request);
}

export const POST = handlers.POST;
