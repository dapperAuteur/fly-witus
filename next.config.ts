import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

// Wrap the Next config with serwist's plugin so `next build` generates
// the service worker (public/sw.js) from src/app/sw.ts. Disabled in dev
// to keep HMR fast and to avoid stale-cache confusion mid-edit.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // PostHog's ingest endpoints use trailing slashes (/e/, /flags/, /s/). Without this,
  // Next issues a 308 to the slashless form before the rewrite runs and ingest breaks.
  // Required by PostHog's documented Next.js proxy setup.
  //
  // SIDE EFFECT worth knowing: this disables Next's automatic trailing-slash redirect
  // for EVERY route, not just /ingest, so /pricing/ no longer 308s to /pricing and both
  // forms become reachable. Nothing in this app links to the trailing-slash form and
  // Next never generates one, so the exposure is limited to an external link or a typo.
  // The durable fix is per-page `alternates.canonical` metadata, which this app does not
  // set anywhere yet; worth adding before any SEO push.
  skipTrailingSlashRedirect: true,

  async rewrites() {
    // Reverse-proxy PostHog through our own origin. us.i.posthog.com is on uBlock
    // Origin, Brave Shields, and Safari's tracker list, so a meaningful share of
    // events never leave the browser — including, reliably, our own test visits.
    // Routing ingest through fly.witus.online leaves blockers nothing to match on.
    //
    // Assets come from a different upstream host than ingest, hence two rules. The
    // more specific /static rule must come first.
    //
    // The shared ecosystem project is US. A US key pointed at the EU cluster fails
    // SILENTLY — no error, no events — so these hosts are pinned here rather than read
    // from env, where a typo would be invisible until someone noticed the data missing.
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
};

// Sentry's build plugin wraps the serwist-wrapped config (outermost, so it sees the final
// webpack/turbopack config and can attach source maps to the real client bundle).
//
// Safe with no Sentry env set: without SENTRY_AUTH_TOKEN it simply skips source-map upload (you
// just get minified stack traces) and the runtime SDK stays inert without a DSN. org / project /
// authToken all come from env so nothing secret is committed here.
export default withSentryConfig(withSerwist(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    // Strips the SDK's own debug logging from the bundle. Replaces the deprecated top-level
    // `disableLogger` option. Webpack-only, so it is a no-op under Turbopack (same as the old
    // flag was), but it silences the v10 deprecation warning.
    treeshake: { removeDebugLogging: true },
  },
});
