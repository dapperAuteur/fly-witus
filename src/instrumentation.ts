import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

// Next.js instrumentation hook. Loads the right Sentry config per runtime, and reports server-side
// App Router errors via onRequestError. Everything is inert without SENTRY_DSN (see the configs).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("../sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("../sentry.edge.config");
}

// Captures errors thrown while rendering or serving a request. We tag the runtime so a Vercel
// Function crash is distinguishable from an edge one at a glance, without adding a lookup (or any
// pilot PII) to the error path. captureRequestError does the rest, and the beforeSend scrub in
// src/lib/sentry-scrub.ts strips the credentials off whatever it collects.
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  Sentry.withScope((scope) => {
    scope.setTag("runtime", process.env.NEXT_RUNTIME ?? "unknown");
    Sentry.captureRequestError(err, request, context);
  });
};
