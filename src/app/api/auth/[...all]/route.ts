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
  const recovery = silentSsoRecoveryPath(new URL(request.url));
  if (recovery) {
    // Relative Location: the browser resolves it against whichever origin it arrived on.
    return new Response(null, { status: 302, headers: { location: recovery } });
  }
  return handlers.GET(request);
}

export const POST = handlers.POST;
