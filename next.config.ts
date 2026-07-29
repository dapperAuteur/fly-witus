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
  /* config options here */
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
  disableLogger: true,
});
