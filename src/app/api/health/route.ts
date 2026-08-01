import { sql } from "drizzle-orm";

// Uptime health check for Better Stack (and any other monitor).
//
// Why this exists: monitors used to point at `/`, which can return a cached 200 from the CDN
// while Postgres is unreachable. A green check then means "the edge served bytes", not "the app
// works". This route proves the request reached a live function AND that the function can reach
// the database, so a green check means something.
//
// Contract:
//   200 {"ok":true,"checks":{"db":"ok"}}
//   503 {"ok":false,"error":"database_unreachable"}
//
// Security: the response body and the log line are fixed literals. A pg connection failure
// carries the connection string - password included - in its message, so neither the caller nor
// the log sink ever sees the caught error. The catch has no binding at all so there is no
// variable to accidentally interpolate later.
//
// Caching: force-dynamic + revalidate 0 + no-store, and the service worker is told to treat this
// path as NetworkOnly (see src/app/sw.ts). A cached health check is a lie by construction.

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

// Bounded so a hung connection returns 503 instead of holding the monitor open until the
// platform's own function timeout. Long enough to survive a cold pool connect.
const DB_TIMEOUT_MS = 4_000;

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

const OK_BODY = JSON.stringify({ ok: true, checks: { db: "ok" } });
const FAIL_BODY = JSON.stringify({ ok: false, error: "database_unreachable" });

/**
 * Cheapest possible liveness probe: `select 1` reads no table, takes no lock, and still forces a
 * real round trip through the pool to Postgres. Returns a boolean only - no error detail escapes
 * this function.
 */
async function isDatabaseLive(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Imported here rather than at module scope so that a failure to construct the client (bad or
    // missing DATABASE_URL, env-validation throw) is caught by this same handler and reported as a
    // plain 503 instead of an unhandled 500 whose stack could quote the connection string.
    const { db } = await import("@/db/client");

    const probe = db.execute(sql`select 1`);
    // If the timeout wins the race, the probe may still reject afterwards. This no-op handler
    // marks that rejection as handled so a slow failure cannot crash the function.
    probe.catch(() => {});

    await Promise.race([
      probe,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("health_check_timeout")), DB_TIMEOUT_MS);
      }),
    ]);

    return true;
  } catch {
    // Constant string only. Never the caught error, its message, or its stack: moving the leak to
    // the log sink is still a leak.
    console.error("[health] database liveness check failed");
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(): Promise<Response> {
  const live = await isDatabaseLive();
  return new Response(live ? OK_BODY : FAIL_BODY, {
    status: live ? 200 : 503,
    headers: HEADERS,
  });
}

// Some monitors probe with HEAD to skip the body. Run the same real check so the status code
// carries the same meaning; the platform drops the body for HEAD.
export async function HEAD(): Promise<Response> {
  const live = await isDatabaseLive();
  return new Response(null, {
    status: live ? 200 : 503,
    headers: HEADERS,
  });
}
