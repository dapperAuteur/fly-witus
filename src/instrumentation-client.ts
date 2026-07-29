import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

// Client-runtime Sentry init. Reads the PUBLIC DSN (inlined at build time). Guarded: with no
// NEXT_PUBLIC_SENTRY_DSN the SDK is inert, so nothing is sent and nothing changes for pilots.
//
// Note for whoever wires the DSN: this app ships a Serwist service worker and works offline, so a
// browser-side report only leaves the device when the pilot is back on network. Server-side
// reporting (sentry.server.config.ts) is the reliable channel; this is the extra one.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // Errors only - no tracing, no session replay (privacy + cost) until BAM opts in.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}

// Instruments App Router client navigations for Sentry (a no-op when init was skipped).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
