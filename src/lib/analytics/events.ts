/**
 * Event taxonomy for Fly.WitUS.
 *
 * The ecosystem shares ONE PostHog project, separated by the `app` property that
 * posthog-provider registers on load. Two rules keep that project readable, and both
 * are cheap now and expensive to retrofit once data has landed:
 *
 *   1. `snake_case`, object first, verb in past tense — `mission_logged`.
 *   2. NEVER put the app name in the event name. `fly_witus_signin_started` is wrong:
 *      it makes the same action from two apps look like two events and kills the
 *      cross-app comparison that sharing a project exists to enable. The `app`
 *      property already carries that.
 *
 * Shared lifecycle events (the SHARED_EVENTS block) use identical names in every
 * ecosystem app, so "where do people fall out of sign-in" is answerable across all of
 * them at once. Do not rename these here without renaming them everywhere.
 *
 * See gemini/witus/plans/26-posthog-ecosystem-rollout.md for the full contract and
 * gemini/witus/lib/analytics/INTEGRATE.md for the integration playbook.
 */

/** Slug carried on every event so this app's data stays separable in the shared project. */
export const ANALYTICS_APP = "fly";

/**
 * Events with identical names across every ecosystem app. Names are contractual.
 */
export const SHARED_EVENTS = {
  signinStarted: "signin_started",
  signinSucceeded: "signin_succeeded",
  signinFailed: "signin_failed",
} as const;

/**
 * Events specific to Fly.WitUS. Identify entities by slug or id, never display name —
 * names get reworded and fragment one thing into several series.
 *
 * Deliberately minimal for now, same as the shop-witus port: route views plus the
 * shared sign-in lifecycle. Product events (checklist completion, mission logging, PDF
 * export) get added when there is a question waiting on them, not speculatively — an
 * event name that ships before anyone needs it is a name nobody can rename later.
 *
 * One thing NOT to instrument without a separate decision: anything carrying flight
 * plan detail, aircraft registration, or document contents. Those are the operator's
 * regulatory records, not product telemetry.
 */
export const EVENTS = {
  /** An explicit route view. capture_pageview is off — Next's client router would
   *  fire it once and then lie — so route changes are reported deliberately. */
  routeViewed: "route_viewed",
  ...SHARED_EVENTS,
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
