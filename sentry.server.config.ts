import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

// Server-runtime Sentry init (Better Stack ingests via the Sentry protocol, so the DSN is just a
// Better Stack source DSN). Loaded from src/instrumentation.ts's register() on the Node runtime.
//
// GUARDED ON THE DSN: with no SENTRY_DSN set, init is skipped entirely and the SDK is inert, so
// the app ships and runs exactly as before until BAM provisions the source and sets the var
// (plans/user-tasks/24-bam-betterstack-sentry-dsn.md).
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Errors only for now - no performance/tracing spend until BAM opts in.
    tracesSampleRate: 0,
    // Never auto-attach IP / cookies / user email; the beforeSend scrub is the second line of defense.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}
